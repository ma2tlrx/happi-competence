-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — relance d'une personne absente par la structure qui l'accompagne
--
-- Espace organisme simplifié (« Mes groupes ») : un conseiller relance une personne
-- de sa structure, absente sans justificatif à sa dernière séance terminée. Le
-- serveur envoie alors un e-mail chaleureux et une notification au participant
-- (src/lib/email/events.ts › notifyAbsenceFollowup, modèle « absence_followup »).
--
-- 1. absence_followups : une ligne par relance, unique par (séance, participant) :
--    une absence ne se relance qu'une fois. Table en ajout seul (suppression par
--    cascade uniquement : effacement d'un participant, purge de la démonstration).
-- 2. Droits : RLS activée et forcée. Lecture par la structure qui a relancé, les
--    formateurs du participant et l'administration. Aucune écriture directe : la
--    fonction relaunch_absent_participant est la seule porte d'entrée.
-- 3. Journal d'activité : chaque relance est tracée par déclencheur (identifiants seulement).
-- 4. relaunch_absent_participant(séance, participant) : vérifie l'appelant (organisme d'une
--    structure active, autorisé à consulter les présences), le participant (de sa structure,
--    inscrit dans le groupe de la séance), la séance (terminée), la présence (« absent »,
--    dernière séance terminée renseignée de la personne) et l'absence de relance antérieure.
--    Même règle que l'interface (src/lib/organisme/groups.ts › followupState).
-- 5. File d'e-mails : nouveau modèle « absence_followup ».
--
-- Rejouable : chaque instruction peut être exécutée une seconde fois sans erreur.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Relances ─────────────────────────────────────────────────────────────
create table if not exists public.absence_followups (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions (id) on delete cascade,
  participant_id  uuid not null references public.participants (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint absence_followups_session_participant_key unique (session_id, participant_id)
);
comment on table public.absence_followups is 'Relances d''une personne absente par sa structure : une seule par absence (séance, participant). Écriture par public.relaunch_absent_participant uniquement.';
comment on column public.absence_followups.organization_id is 'Structure qui a relancé (rattachement du participant au moment de la relance).';
comment on column public.absence_followups.created_by is 'Compte organisme auteur de la relance.';
create index if not exists absence_followups_participant_idx on public.absence_followups (participant_id);
create index if not exists absence_followups_organization_idx on public.absence_followups (organization_id);
create index if not exists absence_followups_created_by_idx on public.absence_followups (created_by);

-- Ajout seul : ni modification ni suppression directe (les cascades restent possibles).
drop trigger if exists absence_followups_append_only on public.absence_followups;
create trigger absence_followups_append_only before update or delete on public.absence_followups
  for each row execute function private.append_only();

-- ── 2. Droits ───────────────────────────────────────────────────────────────
alter table public.absence_followups enable row level security;
alter table public.absence_followups force row level security;
revoke all on public.absence_followups from public, anon, authenticated, service_role;
grant select on public.absence_followups to authenticated, service_role;

drop policy if exists absence_followups_select on public.absence_followups;
create policy absence_followups_select on public.absence_followups for select to authenticated using (
  (select private.is_admin())
  or organization_id = any ((select private.my_organization_ids())::uuid[])
  or private.trains_participant(participant_id)
);

-- ── 3. Journal d'activité ───────────────────────────────────────────────────
create or replace function private.absence_followups_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.audit('absence_followup.sent', 'session', new.session_id::text, new.organization_id, new.participant_id,
    jsonb_build_object('followup_id', new.id));
  return null;
end;
$$;

drop trigger if exists absence_followups_after_insert on public.absence_followups;
create trigger absence_followups_after_insert after insert on public.absence_followups
  for each row execute function private.absence_followups_after_insert();

-- ── 4. Relance ──────────────────────────────────────────────────────────────
-- Ordre des contrôles : l'appelant et le rattachement du participant d'abord, pour qu'un message
-- ne révèle jamais rien (séance, présence) d'une personne suivie par une autre structure.
create or replace function public.relaunch_absent_participant(p_session_id uuid, p_participant_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_group uuid;
  v_session_status text;
  v_member_status text;
  v_attendance text;
  v_latest uuid;
  v_id uuid;
begin
  if p_session_id is null or p_participant_id is null then
    raise exception 'Indiquez la séance et la personne à relancer.' using errcode = '22023';
  end if;
  if private.current_role_code() is distinct from 'organisme' then
    raise exception 'Seul un compte organisme peut relancer une personne absente.' using errcode = '42501';
  end if;
  if cardinality(private.my_organization_ids()) = 0 then
    raise exception 'Votre structure n’est pas active : la relance est impossible.' using errcode = '42501';
  end if;
  -- Sans accès aux présences, la structure ne voit pas les absences : elle ne peut pas relancer
  -- (et la fonction ne doit pas servir à les deviner).
  if not private.has_permission('org.attendance.read') then
    raise exception 'Votre structure n’a pas accès aux présences : la relance est impossible.' using errcode = '42501';
  end if;

  select p.organization_id into v_org
  from public.participants p
  where p.id = p_participant_id and p.organization_id = any (private.my_organization_ids());
  if v_org is null then
    raise exception 'Cette personne n’est pas suivie par votre structure.' using errcode = '42501';
  end if;

  select s.group_id, s.status, gm.status into v_group, v_session_status, v_member_status
  from public.sessions s
  join public.group_members gm on gm.group_id = s.group_id and gm.participant_id = p_participant_id
  where s.id = p_session_id;
  if v_group is null or v_member_status = 'removed' then
    raise exception 'Cette personne n’est pas inscrite dans le groupe de cette séance.' using errcode = 'P0001';
  end if;
  if v_member_status = 'dropped' then
    raise exception 'Parcours interrompu : pas de relance.' using errcode = 'P0001';
  end if;
  if v_session_status <> 'completed' then
    raise exception 'Cette séance n’est pas terminée : la relance n’est pas encore possible.' using errcode = 'P0001';
  end if;

  select a.status into v_attendance
  from public.attendance a
  where a.session_id = p_session_id and a.participant_id = p_participant_id;
  if v_attendance = 'excused' then
    raise exception 'Absence justifiée : pas de relance.' using errcode = 'P0001';
  elsif v_attendance is distinct from 'absent' then
    raise exception 'Cette personne n’est pas notée absente à cette séance.' using errcode = 'P0001';
  end if;

  -- Seule la dernière séance terminée renseignée de la personne compte : revenue depuis, elle n'est plus relancée.
  select s.id into v_latest
  from public.sessions s
  join public.attendance a on a.session_id = s.id and a.participant_id = p_participant_id
  where s.group_id = v_group and s.status = 'completed'
  order by coalesce(s.scheduled_date, date '9999-12-31') desc, s.number desc
  limit 1;
  if v_latest is distinct from p_session_id then
    raise exception 'Une séance plus récente a eu lieu depuis : seule la dernière absence peut être relancée.' using errcode = 'P0001';
  end if;

  insert into public.absence_followups (session_id, participant_id, organization_id, created_by)
  values (p_session_id, p_participant_id, v_org, (select auth.uid()))
  on conflict (session_id, participant_id) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'Cette personne a déjà été relancée pour cette absence.' using errcode = 'P0001';
  end if;
  return v_id;
end;
$$;
comment on function public.relaunch_absent_participant(uuid, uuid) is 'Relance (une fois) une personne absente sans justificatif à sa dernière séance terminée. Réservé aux organismes actifs autorisés à consulter les présences. Renvoie l''identifiant de la relance.';

revoke execute on function public.relaunch_absent_participant(uuid, uuid) from public, anon;
grant execute on function public.relaunch_absent_participant(uuid, uuid) to authenticated;

-- ── 5. File d'e-mails : modèle « absence_followup » ─────────────────────────
alter table public.email_outbox drop constraint if exists email_outbox_template_check;
alter table public.email_outbox add constraint email_outbox_template_check check (template in (
  'session_convocation', 'session_reminder', 'session_updated', 'session_cancelled',
  'report_available', 'participant_invitation', 'referral_update', 'absence_followup', 'test'));
