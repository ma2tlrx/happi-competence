-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — abandons, situations d'entrée / de sortie, suivis à 3 et
-- 6 mois (axe A de docs/audit-strategique.md)
--
-- 1. group_members : nouveau statut « dropped » (abandon) distinct de « removed »
--    (retrait pour erreur d'inscription), avec motif et date d'abandon.
--    Un abandon n'est plus actif (feuilles de présence, capacité du groupe,
--    annuaire des participants sans groupe) mais reste dans l'historique :
--    l'organisme et le participant continuent de voir le groupe et ses sessions.
-- 2. participant_outcomes : situation du participant à l'entrée, à la sortie,
--    à 3 mois et à 6 mois. Une ligne par (participant, groupe, moment), modifiable,
--    chaque écriture étant tracée dans le journal d'activité (déclencheur d'audit).
--    Catégories provisoires — à aligner sur les nomenclatures des financeurs
--    (FSE+, France Travail, CEJ).
-- 3. Permissions : outcomes.write (formateur), org.outcomes.write et
--    org.impact.read (organisme).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Abandons ─────────────────────────────────────────────────────────────
alter table public.group_members drop constraint if exists group_members_status_check;
alter table public.group_members
  add column drop_reason  text check (drop_reason in (
    'emploi_trouve', 'entree_formation', 'sante', 'demenagement', 'motif_personnel', 'sans_nouvelles', 'autre')),
  add column drop_details text check (drop_details is null or char_length(drop_details) <= 300),
  add column dropped_at   date;
alter table public.group_members
  add constraint group_members_status_check check (status in ('active', 'removed', 'dropped')),
  add constraint group_members_drop_consistency check (
    (status = 'dropped') = (drop_reason is not null and dropped_at is not null)
  ),
  add constraint group_members_drop_other_details check (drop_reason is distinct from 'autre' or drop_details is not null);
comment on column public.group_members.status is 'active : inscrit ; dropped : abandon (motif et date renseignés, conservé dans les statistiques) ; removed : retiré (erreur d''inscription, exclu des statistiques).';
comment on column public.group_members.drop_reason is 'Motif d''abandon (liste provisoire, à valider).';
comment on column public.group_members.dropped_at is 'Date de l''abandon, point de départ des suivis à 3 et 6 mois.';
create index group_members_status_idx on public.group_members (group_id, status);

create or replace function private.group_members_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_max int;
  v_count int;
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    select p.max_group_size into v_max
    from public.groups g join public.programs p on p.id = g.program_id
    where g.id = new.group_id
    for update of g;
    select count(*) into v_count from public.group_members gm
    where gm.group_id = new.group_id and gm.status = 'active' and gm.id <> new.id;
    if v_count >= v_max then
      raise exception 'Ce groupe est complet : % participants au maximum pour ce programme.', v_max using errcode = 'P0001';
    end if;
    new.left_at := null;
  elsif new.status in ('removed', 'dropped') and new.left_at is null then
    new.left_at := now();
  end if;

  if new.status = 'dropped' then
    new.drop_details := nullif(trim(new.drop_details), '');
    new.dropped_at := coalesce(new.dropped_at, current_date);
    if new.dropped_at > current_date then
      raise exception 'La date d’abandon ne peut pas être dans le futur.' using errcode = '22023';
    end if;
    if new.drop_reason is null then
      raise exception 'Indiquez le motif de l’abandon.' using errcode = '22023';
    end if;
    if new.drop_reason = 'autre' and new.drop_details is null then
      raise exception 'Précisez le motif de l’abandon.' using errcode = '22023';
    end if;
  else
    -- Réintégration ou retrait : le motif d'abandon ne s'applique plus (il reste dans le journal).
    new.drop_reason := null;
    new.drop_details := null;
    new.dropped_at := null;
  end if;

  if tg_op = 'INSERT' then
    new.added_by := coalesce(new.added_by, (select auth.uid()));
  end if;
  return new;
end;
$$;

create or replace function private.group_members_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_group public.groups%rowtype;
  v_user uuid;
begin
  if tg_op = 'DELETE' then
    perform private.audit('group.member_deleted', 'group', old.group_id::text, null, old.participant_id);
    return null;
  end if;
  select * into v_group from public.groups where id = new.group_id;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform private.audit(
      case new.status when 'active' then 'group.member_added' when 'dropped' then 'group.member_dropped' else 'group.member_removed' end,
      'group', new.group_id::text, v_group.organization_id, new.participant_id,
      case when new.status = 'dropped'
        then jsonb_build_object('reason', new.drop_reason, 'dropped_at', new.dropped_at)
        else jsonb_build_object('previous', case when tg_op = 'UPDATE' then old.status end) end);
    if new.status = 'active' then
      select p.user_id into v_user from public.participants p where p.id = new.participant_id;
      perform private.notify(v_user, 'group.joined', 'Vous avez rejoint un groupe',
        'Vous faites maintenant partie du groupe « ' || v_group.name || ' ». Retrouvez vos sessions dans votre parcours.',
        '/participant/parcours');
    end if;
  elsif new.status = 'dropped' and (new.drop_reason is distinct from old.drop_reason or new.dropped_at is distinct from old.dropped_at
                                    or new.drop_details is distinct from old.drop_details) then
    perform private.audit('group.member_drop_updated', 'group', new.group_id::text, v_group.organization_id, new.participant_id,
      jsonb_build_object('reason', new.drop_reason, 'previous_reason', old.drop_reason, 'dropped_at', new.dropped_at));
  end if;
  return null;
end;
$$;

-- Un abandon reste dans l'historique : l'organisme du participant et le participant lui-même
-- continuent de voir le groupe et ses sessions passées. Un retrait (erreur d'inscription) non.
create or replace function private.org_sees_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group_id and g.organization_id = any (private.my_organization_ids())
  ) or exists (
    select 1 from public.group_members gm
    join public.participants p on p.id = gm.participant_id
    where gm.group_id = p_group_id and gm.status in ('active', 'dropped')
      and p.organization_id = any (private.my_organization_ids())
  );
$$;

create or replace function private.member_of_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members gm
    join public.participants p on p.id = gm.participant_id
    where gm.group_id = p_group_id and gm.status in ('active', 'dropped') and p.user_id = (select auth.uid())
  );
$$;

-- ── 2. Permissions ──────────────────────────────────────────────────────────
insert into public.permissions (code, label, description, applicable_roles, position) values
  ('outcomes.write', 'Renseigner les situations des participants',
   'Saisir la situation à l’entrée, à la sortie et lors des suivis à 3 et 6 mois des participants de ses groupes.', '{formateur}', 11),
  ('org.outcomes.write', 'Renseigner les situations des participants',
   'Saisir la situation à l’entrée, à la sortie et lors des suivis à 3 et 6 mois des participants rattachés à l’organisme.', '{organisme}', 12),
  ('org.impact.read', 'Consulter le tableau de bord d’impact',
   'Lire les indicateurs (assiduité, abandons, progression, situations de sortie) des participants rattachés à l’organisme.', '{organisme}', 13)
on conflict (code) do nothing;

insert into public.role_permissions (role_code, permission_code) values
  ('formateur', 'outcomes.write'),
  ('organisme', 'org.outcomes.write'),
  ('organisme', 'org.impact.read')
on conflict do nothing;

-- ── 3. Situations des participants ──────────────────────────────────────────
create table public.participant_outcomes (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  group_id       uuid references public.groups (id) on delete cascade,
  kind           text not null check (kind in ('entry', 'exit', 'followup_3m', 'followup_6m')),
  situation      text not null check (situation in (
    'emploi_durable', 'emploi_transition', 'formation_qualifiante', 'creation_activite',
    'immersion_stage', 'recherche_emploi', 'autre_etape', 'sans_nouvelles')),
  details        text check (details is null or char_length(details) <= 500),
  observed_on    date not null default current_date,
  recorded_by    uuid references public.profiles (id) on delete set null,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint participant_outcomes_unique unique nulls not distinct (participant_id, group_id, kind)
);
comment on table public.participant_outcomes is 'Situation du participant à l''entrée, à la sortie, à 3 et 6 mois. Catégories provisoires — à aligner sur les nomenclatures des financeurs (FSE+, France Travail, CEJ).';
comment on column public.participant_outcomes.group_id is 'Cohorte concernée ; nul pour une situation hors groupe.';
comment on column public.participant_outcomes.recorded_by is 'Auteur de la dernière saisie (chaque modification est tracée dans audit_logs).';
create index participant_outcomes_group_idx on public.participant_outcomes (group_id, kind);

create or replace function private.can_read_participant_outcomes(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or p_participant_id = private.my_participant_id()
      or private.trains_participant(p_participant_id)
      or ((private.has_permission('org.impact.read') or private.has_permission('org.outcomes.write'))
          and private.org_sees_participant(p_participant_id));
$$;

create or replace function private.can_write_participant_outcome(p_participant_id uuid, p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or (private.current_role_code() = 'formateur' and private.has_permission('outcomes.write')
          and case when p_group_id is null then private.trains_participant(p_participant_id)
                   else private.trains_group(p_group_id) end)
      or (private.current_role_code() = 'organisme' and private.has_permission('org.outcomes.write')
          and private.org_sees_participant(p_participant_id));
$$;

create or replace function private.participant_outcomes_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.participant_id is distinct from old.participant_id
                           or new.group_id is distinct from old.group_id or new.kind is distinct from old.kind) then
    raise exception 'Une situation ne peut pas être déplacée vers un autre participant, groupe ou moment du parcours.' using errcode = 'P0001';
  end if;
  if new.group_id is not null and not exists (
    select 1 from public.group_members gm
    where gm.group_id = new.group_id and gm.participant_id = new.participant_id and gm.status in ('active', 'dropped')
  ) then
    raise exception 'Ce participant ne fait pas partie de ce groupe.' using errcode = 'P0001';
  end if;
  if new.observed_on > current_date then
    raise exception 'La date d’observation ne peut pas être dans le futur.' using errcode = '22023';
  end if;
  new.details := nullif(trim(new.details), '');
  new.recorded_by := coalesce((select auth.uid()), new.recorded_by);
  if tg_op = 'INSERT' then
    new.created_by := coalesce((select auth.uid()), new.created_by);
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger participant_outcomes_guard before insert or update on public.participant_outcomes
  for each row execute function private.participant_outcomes_guard();

-- Historique : chaque saisie, modification ou suppression est journalisée (sans le texte libre).
create or replace function private.participant_outcomes_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_row public.participant_outcomes%rowtype;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  select p.organization_id into v_org from public.participants p where p.id = v_row.participant_id;
  if tg_op = 'INSERT' then
    perform private.audit('outcome.recorded', 'participant', v_row.participant_id::text, v_org, v_row.participant_id,
      jsonb_build_object('kind', new.kind, 'situation', new.situation, 'observed_on', new.observed_on, 'group_id', new.group_id));
  elsif tg_op = 'UPDATE' then
    if new.situation is distinct from old.situation or new.observed_on is distinct from old.observed_on
       or new.details is distinct from old.details then
      perform private.audit('outcome.updated', 'participant', v_row.participant_id::text, v_org, v_row.participant_id,
        jsonb_build_object('kind', new.kind, 'situation', new.situation, 'previous_situation', old.situation,
          'observed_on', new.observed_on, 'previous_observed_on', old.observed_on,
          'details_changed', new.details is distinct from old.details, 'group_id', new.group_id));
    end if;
  else
    perform private.audit('outcome.deleted', 'participant', v_row.participant_id::text, v_org, v_row.participant_id,
      jsonb_build_object('kind', old.kind, 'situation', old.situation, 'group_id', old.group_id));
  end if;
  return null;
end;
$$;
create trigger participant_outcomes_audit after insert or update or delete on public.participant_outcomes
  for each row execute function private.participant_outcomes_audit();

-- ── RLS ─────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.participant_outcomes to authenticated;
revoke all on public.participant_outcomes from anon;
alter table public.participant_outcomes enable row level security;
alter table public.participant_outcomes force row level security;

create policy participant_outcomes_select on public.participant_outcomes for select to authenticated
  using (private.can_read_participant_outcomes(participant_id));
create policy participant_outcomes_insert on public.participant_outcomes for insert to authenticated
  with check (private.can_write_participant_outcome(participant_id, group_id));
create policy participant_outcomes_update on public.participant_outcomes for update to authenticated
  using (private.can_write_participant_outcome(participant_id, group_id))
  with check (private.can_write_participant_outcome(participant_id, group_id));
create policy participant_outcomes_delete on public.participant_outcomes for delete to authenticated
  using ((select private.is_admin()));
