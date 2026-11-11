-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — bilans individuels versionnés
--
-- Un bilan est une photographie : les résultats (`data`) sont calculés une fois,
-- à la création, à partir des évaluations validées, et ne changent plus. Le texte
-- (`content`) peut être rédigé, régénéré ou corrigé tant que le bilan est en
-- brouillon ; une fois validé, plus rien ne bouge. Un nouveau calcul crée une
-- nouvelle version : un ancien bilan n'est jamais modifié en silence.
-- ════════════════════════════════════════════════════════════════════════════

create table public.participant_reports (
  id                   uuid primary key default gen_random_uuid(),
  participant_id       uuid not null references public.participants (id) on delete cascade,
  version              int  not null,
  status               text not null default 'draft' check (status in ('draft', 'final')),
  -- Résultats figés (voir src/lib/report/build.ts) et version des règles de calcul du bilan.
  data                 jsonb not null,
  engine_version       text not null check (char_length(engine_version) <= 40),
  -- Texte du bilan (schéma : src/lib/report/content.ts). Nul tant que rien n'est rédigé.
  content              jsonb,
  content_source       text check (content_source in ('ai', 'ai_edited', 'manual')),
  content_model        text check (char_length(content_model) <= 80),
  content_generated_at timestamptz,
  -- Réglages d'édition : sections masquées, structure affichée, observations complémentaires.
  options              jsonb not null default '{}'::jsonb,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  finalized_at         timestamptz,
  finalized_by         uuid references public.profiles (id) on delete set null,
  unique (participant_id, version),
  check ((status = 'final') = (finalized_at is not null)),
  check (status = 'draft' or content is not null)
);
comment on table public.participant_reports is 'Bilans individuels : résultats figés à la création, texte modifiable jusqu''à la validation.';
comment on column public.participant_reports.data is 'Photographie des résultats (niveaux, observations, couverture). Immuable.';
create index participant_reports_participant_idx on public.participant_reports (participant_id, version desc);

create trigger participant_reports_set_updated_at before update on public.participant_reports
  for each row execute function private.set_updated_at();

-- Numérotation et garde-fous : version attribuée par la base, résultats immuables,
-- bilan validé figé, auteur et validateur renseignés côté serveur.
create or replace function private.participant_reports_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('participant_reports:' || new.participant_id::text));
    select coalesce(max(r.version), 0) + 1 into new.version
      from public.participant_reports r where r.participant_id = new.participant_id;
    new.created_by := (select auth.uid());
    new.status := 'draft';
    new.finalized_at := null;
    new.finalized_by := null;
    return new;
  end if;
  if old.status = 'final' then
    raise exception 'Ce bilan est validé : il ne peut plus être modifié. Créez une nouvelle version.' using errcode = 'P0001';
  end if;
  if new.data is distinct from old.data or new.engine_version is distinct from old.engine_version
     or new.participant_id is distinct from old.participant_id or new.version is distinct from old.version
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Les résultats d''un bilan ne se modifient pas : créez une nouvelle version.' using errcode = 'P0001';
  end if;
  if new.status = 'final' then
    if new.content is null then
      raise exception 'Rédigez le bilan avant de le valider.' using errcode = 'P0001';
    end if;
    new.finalized_at := now();
    new.finalized_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger participant_reports_guard before insert or update on public.participant_reports
  for each row execute function private.participant_reports_guard();

-- ── Droits ──────────────────────────────────────────────────────────────────
-- Formateurs du participant et administrateurs : tout, en brouillon.
-- Participant et organisme rattaché : lecture des seuls bilans validés.
alter table public.participant_reports enable row level security;

create policy participant_reports_select on public.participant_reports for select to authenticated
  using (
    private.is_admin()
    or private.trains_participant(participant_id)
    or (status = 'final' and (participant_id = private.my_participant_id() or private.org_sees_participant(participant_id)))
  );

create policy participant_reports_insert on public.participant_reports for insert to authenticated
  with check (private.is_admin() or private.trains_participant(participant_id));

create policy participant_reports_update on public.participant_reports for update to authenticated
  using (status = 'draft' and (private.is_admin() or private.trains_participant(participant_id)))
  with check (private.is_admin() or private.trains_participant(participant_id));

create policy participant_reports_delete on public.participant_reports for delete to authenticated
  using (status = 'draft' and (private.is_admin() or private.trains_participant(participant_id)));

grant select, insert, update, delete on public.participant_reports to authenticated;

-- ── Journal ─────────────────────────────────────────────────────────────────
create or replace function private.participant_reports_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_action text;
begin
  select p.organization_id into v_org from public.participants p where p.id = new.participant_id;
  if tg_op = 'INSERT' then
    v_action := 'report.created';
  elsif new.status = 'final' and old.status = 'draft' then
    v_action := 'report.finalized';
  elsif new.content is distinct from old.content then
    v_action := 'report.content_updated';
  else
    return null;
  end if;
  perform private.audit(v_action, 'participant_report', new.id::text, v_org, new.participant_id,
    jsonb_build_object('version', new.version, 'content_source', new.content_source));
  return null;
end;
$$;

create trigger participant_reports_audit after insert or update on public.participant_reports
  for each row execute function private.participant_reports_audit();

-- Téléchargement d'un bilan : action journalisable.
create or replace function public.log_event(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_participant uuid;
  v_org uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if p_action not in (
    'participant_file.viewed', 'export.passport_pdf', 'export.attendance_pdf', 'export.attendance_csv',
    'export.participants_csv', 'export.personal_data', 'auth.signed_in', 'auth.password_changed', 'export.report_pdf'
  ) then
    raise exception 'Action non journalisable.' using errcode = '22023';
  end if;
  if p_entity_type = 'participant' and p_entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_participant := p_entity_id::uuid;
    select p.organization_id into v_org from public.participants p where p.id = v_participant;
  end if;
  perform private.audit(p_action, left(p_entity_type, 40), left(p_entity_id, 80), v_org, v_participant,
    case when pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 1500 then '{}'::jsonb else coalesce(p_metadata, '{}'::jsonb) end);
end;
$$;
