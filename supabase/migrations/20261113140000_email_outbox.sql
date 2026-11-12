-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — e-mails transactionnels : file d'envoi et préférences
--
-- Chaque e-mail (convocation, rappel J-1, séance modifiée ou annulée, bilan
-- disponible, invitation, test) est d'abord inscrit dans `email_outbox`, puis
-- envoyé par le serveur (src/lib/email/outbox.ts). La clé d'idempotence unique
-- garantit qu'un même message n'est jamais mis en file, donc envoyé, deux fois.
--
-- Droits : lecture réservée aux administrateurs ; aucune écriture possible avec
-- une session utilisateur (le serveur écrit avec la clé de service, après avoir
-- vérifié les droits de l'appelant). Les adresses ne sont jamais copiées dans
-- le journal d'activité.
-- ════════════════════════════════════════════════════════════════════════════

create table public.email_outbox (
  id                  uuid primary key default gen_random_uuid(),
  idempotency_key     text not null unique check (char_length(idempotency_key) between 3 and 200),
  template            text not null check (template in (
                        'session_convocation', 'session_reminder', 'session_updated', 'session_cancelled',
                        'report_available', 'participant_invitation', 'test')),
  -- Adresse de destination (nulle pour un participant sans adresse : la ligne est alors « skipped »).
  recipient_email     text check (recipient_email is null or (char_length(recipient_email) <= 254 and recipient_email = lower(recipient_email))),
  recipient_user_id   uuid references public.profiles (id) on delete cascade,
  -- Rattachements : la suppression d'un participant, d'une séance ou d'un bilan efface ses e-mails
  -- (effacement RGPD, purge de la démonstration).
  participant_id      uuid references public.participants (id) on delete cascade,
  session_id          uuid references public.sessions (id) on delete cascade,
  report_id           uuid references public.participant_reports (id) on delete cascade,
  subject             text not null check (char_length(subject) <= 200),
  data                jsonb not null default '{}'::jsonb,
  status              text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts            int  not null default 0 check (attempts >= 0),
  last_error          text check (last_error is null or char_length(last_error) <= 500),
  provider            text check (provider is null or provider in ('brevo', 'smtp', 'resend', 'journal')),
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 200),
  is_demo             boolean not null default false,
  next_attempt_at     timestamptz not null default now(),
  locked_until        timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  sent_at             timestamptz,
  check ((status = 'sent') = (sent_at is not null))
);
comment on table public.email_outbox is 'File d''envoi des e-mails transactionnels. Écriture par le serveur uniquement ; lecture administrateur.';
comment on column public.email_outbox.idempotency_key is 'Ex. reminder:<session_id>:<participant_id>:<date>. Unique : un message n''est jamais envoyé deux fois.';
comment on column public.email_outbox.data is 'Variables du modèle (prénom, date, lieu…), sans secret. Les liens sont relatifs et rendus absolus à l''envoi.';
create index email_outbox_pending_idx on public.email_outbox (next_attempt_at) where status in ('queued', 'failed');
create index email_outbox_created_idx on public.email_outbox (created_at desc);
create index email_outbox_participant_idx on public.email_outbox (participant_id);
create index email_outbox_session_idx on public.email_outbox (session_id);
create index email_outbox_report_idx on public.email_outbox (report_id);
create index email_outbox_user_idx on public.email_outbox (recipient_user_id);

create trigger email_outbox_set_updated_at before update on public.email_outbox
  for each row execute function private.set_updated_at();

-- ── Préférences d'e-mail (par compte) ───────────────────────────────────────
-- Seuls les rappels J-1 sont facultatifs : convocations, modifications et
-- annulations de séance restent envoyées (informations indispensables).
create table public.email_preferences (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  reminders  boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.email_preferences is 'Préférences d''e-mail. Absence de ligne : valeurs par défaut (rappels activés).';
create trigger email_preferences_set_updated_at before update on public.email_preferences
  for each row execute function private.set_updated_at();

-- ── Droits ──────────────────────────────────────────────────────────────────
alter table public.email_outbox enable row level security;
alter table public.email_outbox force row level security;
alter table public.email_preferences enable row level security;
alter table public.email_preferences force row level security;

revoke all on public.email_outbox, public.email_preferences from anon, authenticated;
grant select on public.email_outbox to authenticated;
grant select, insert, update on public.email_preferences to authenticated;
grant all on public.email_outbox, public.email_preferences to service_role;

create policy email_outbox_select on public.email_outbox for select to authenticated
  using ((select private.is_admin()));

create policy email_preferences_select on public.email_preferences for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy email_preferences_insert on public.email_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy email_preferences_update on public.email_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Réservation d'un lot à envoyer (serveur uniquement) ────────────────────
-- Prend au plus p_limit messages en attente (nouveaux ou en échec sous le plafond
-- de tentatives), les verrouille cinq minutes et compte la tentative. Deux
-- traitements simultanés ne reçoivent jamais le même message (skip locked).
create or replace function public.claim_email_outbox(p_limit int default 20, p_max_attempts int default 5)
returns setof public.email_outbox
language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.email_outbox o
     set locked_until = now() + interval '5 minutes',
         attempts = o.attempts + 1
   where o.id in (
     select c.id from public.email_outbox c
      where c.status in ('queued', 'failed')
        and c.attempts < greatest(1, p_max_attempts)
        and c.next_attempt_at <= now()
        and (c.locked_until is null or c.locked_until < now())
      order by c.next_attempt_at
      limit greatest(1, least(coalesce(p_limit, 20), 100))
      for update skip locked
   )
  returning o.*;
end;
$$;
revoke all on function public.claim_email_outbox(int, int) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(int, int) to service_role;

-- ── Journal : envoi réussi ou abandon définitif (sans adresse) ──────────────
create or replace function private.email_outbox_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  -- Envoi réussi, ou échec définitif : résultat enregistré (verrou libéré) avec le plafond de
  -- tentatives atteint (5, voir MAX_ATTEMPTS dans src/lib/email/schedule.ts).
  if not (
    (new.status = 'sent' and old.status <> 'sent')
    or (new.status = 'failed' and new.attempts >= 5 and old.locked_until is not null and new.locked_until is null)
  ) then
    return null;
  end if;
  if new.participant_id is not null then
    select p.organization_id into v_org from public.participants p where p.id = new.participant_id;
  end if;
  perform private.audit(
    case when new.status = 'sent' then 'email.sent' else 'email.failed' end,
    'email_outbox', new.id::text, v_org, new.participant_id,
    jsonb_build_object('template', new.template, 'provider', new.provider, 'attempts', new.attempts)
  );
  return null;
end;
$$;

create trigger email_outbox_audit after update on public.email_outbox
  for each row execute function private.email_outbox_audit();
