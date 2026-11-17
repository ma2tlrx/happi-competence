-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — aide à l'observation et restitution accessible
--
-- 1. Assistant d'observation : public.authorize_observation_assist vérifie, avant
--    tout appel au service d'IA, que le compte peut évaluer ce participant pour
--    cette séance (administrateur, ou formateur du groupe avec le droit
--    « evaluations.write », participant membre actif du groupe), puis journalise
--    l'usage (« ai.observation_structured »), sans aucun texte : les notes brutes ne
--    sont jamais enregistrées par cette fonction.
-- 2. Version « facile à lire » d'un bilan validé : table versionnée, mêmes droits
--    que les bilans. Proposée par l'IA (ou rédigée à la main), relue puis validée
--    par le formateur ; seules les versions validées sont visibles du participant
--    et de son organisme. Une version validée ne se modifie ni ne se supprime.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Assistant d'observation ──────────────────────────────────────────────
create or replace function public.authorize_observation_assist(p_session_id uuid, p_participant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid;
  v_org uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  v_group := private.session_group_id(p_session_id);
  if v_group is null
     or not private.can_write_evaluation(p_session_id)
     or not exists (
       select 1 from public.group_members gm
       where gm.group_id = v_group and gm.participant_id = p_participant_id and gm.status = 'active'
     ) then
    raise exception 'Vous ne pouvez structurer des notes que pour les participants de vos groupes.' using errcode = '42501';
  end if;
  select p.organization_id into v_org from public.participants p where p.id = p_participant_id;
  perform private.audit('ai.observation_structured', 'session', p_session_id::text, v_org, p_participant_id, '{}'::jsonb);
end;
$$;

revoke execute on function public.authorize_observation_assist(uuid, uuid) from public, anon;
grant execute on function public.authorize_observation_assist(uuid, uuid) to authenticated;

-- ── 2. Version facile à lire d'un bilan validé ──────────────────────────────
create table public.participant_report_easy_reads (
  id             uuid primary key default gen_random_uuid(),
  report_id      uuid not null references public.participant_reports (id) on delete cascade,
  -- Recopié du bilan par la base (jamais fourni par le client) : sert aux droits.
  participant_id uuid not null references public.participants (id) on delete cascade,
  version        int  not null,
  status         text not null default 'draft' check (status in ('draft', 'validated')),
  -- Schéma : src/lib/report/easy-read.ts (sections de phrases courtes).
  content        jsonb not null,
  content_source text not null check (content_source in ('ai', 'ai_edited', 'manual')),
  content_model  text check (char_length(content_model) <= 80),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  validated_at   timestamptz,
  validated_by   uuid references public.profiles (id) on delete set null,
  unique (report_id, version),
  check ((status = 'validated') = (validated_at is not null)),
  check (pg_column_size(content) <= 60000)
);
comment on table public.participant_report_easy_reads is
  'Version « facile à lire » (inspirée du FALC, non certifiée) d''un bilan validé : brouillon relu puis validé par le formateur.';
create index participant_report_easy_reads_report_idx on public.participant_report_easy_reads (report_id, version desc);
create index participant_report_easy_reads_participant_idx on public.participant_report_easy_reads (participant_id);

create trigger participant_report_easy_reads_set_updated_at before update on public.participant_report_easy_reads
  for each row execute function private.set_updated_at();

create or replace function private.participant_report_easy_reads_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_participant uuid;
  v_status text;
begin
  if tg_op = 'INSERT' then
    select r.participant_id, r.status into v_participant, v_status from public.participant_reports r where r.id = new.report_id;
    if v_participant is null then
      raise exception 'Bilan introuvable.' using errcode = 'P0001';
    end if;
    if v_status <> 'final' then
      raise exception 'La version facile à lire se prépare à partir d''un bilan validé.' using errcode = 'P0001';
    end if;
    perform pg_advisory_xact_lock(hashtext('participant_report_easy_reads:' || new.report_id::text));
    select coalesce(max(e.version), 0) + 1 into new.version
      from public.participant_report_easy_reads e where e.report_id = new.report_id;
    new.participant_id := v_participant;
    new.created_by := (select auth.uid());
    new.status := 'draft';
    new.validated_at := null;
    new.validated_by := null;
    return new;
  end if;
  if old.status = 'validated' then
    raise exception 'Cette version facile à lire est validée : elle ne peut plus être modifiée. Préparez-en une nouvelle.' using errcode = 'P0001';
  end if;
  if new.report_id is distinct from old.report_id or new.participant_id is distinct from old.participant_id
     or new.version is distinct from old.version or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Le rattachement d''une version facile à lire ne se modifie pas.' using errcode = 'P0001';
  end if;
  if new.status = 'validated' then
    new.validated_at := now();
    new.validated_by := (select auth.uid());
  else
    new.validated_at := null;
    new.validated_by := null;
  end if;
  return new;
end;
$$;

create trigger participant_report_easy_reads_guard before insert or update on public.participant_report_easy_reads
  for each row execute function private.participant_report_easy_reads_guard();

-- Droits identiques aux bilans : l'équipe du participant voit et prépare les
-- brouillons ; le participant et son organisme ne lisent que les versions validées.
alter table public.participant_report_easy_reads enable row level security;
alter table public.participant_report_easy_reads force row level security;

create policy participant_report_easy_reads_select on public.participant_report_easy_reads for select to authenticated
  using (
    private.is_admin()
    or private.trains_participant(participant_id)
    or (status = 'validated' and (participant_id = private.my_participant_id() or private.org_sees_participant(participant_id)))
  );

create policy participant_report_easy_reads_insert on public.participant_report_easy_reads for insert to authenticated
  with check (private.is_admin() or private.trains_participant(participant_id));

create policy participant_report_easy_reads_update on public.participant_report_easy_reads for update to authenticated
  using (status = 'draft' and (private.is_admin() or private.trains_participant(participant_id)))
  with check (private.is_admin() or private.trains_participant(participant_id));

create policy participant_report_easy_reads_delete on public.participant_report_easy_reads for delete to authenticated
  using (status = 'draft' and (private.is_admin() or private.trains_participant(participant_id)));

grant select, insert, update, delete on public.participant_report_easy_reads to authenticated;

-- ── Journal ─────────────────────────────────────────────────────────────────
create or replace function private.participant_report_easy_reads_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_action text;
begin
  select p.organization_id into v_org from public.participants p where p.id = new.participant_id;
  if tg_op = 'INSERT' then
    v_action := 'report.easy_read_created';
  elsif new.status = 'validated' and old.status = 'draft' then
    v_action := 'report.easy_read_validated';
  elsif new.content is distinct from old.content then
    v_action := 'report.easy_read_updated';
  else
    return null;
  end if;
  perform private.audit(v_action, 'participant_report', new.report_id::text, v_org, new.participant_id,
    jsonb_build_object('easy_read_id', new.id, 'version', new.version, 'content_source', new.content_source));
  return null;
end;
$$;

create trigger participant_report_easy_reads_audit after insert or update on public.participant_report_easy_reads
  for each row execute function private.participant_report_easy_reads_audit();
