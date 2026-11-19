-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — financeurs, conventions de financement et rattachement des
-- groupes (chantier F1 : bilan d'action et bilan pédagogique et financier)
--
-- 1. funders : financeurs (France Travail, Région, OPCO, FSE+…), contact facultatif.
-- 2. funding_conventions : convention ou marché (référence, action, période,
--    participants et durée conventionnés, montant facultatif, statut, notes).
-- 3. funding_convention_groups : un groupe est rattaché à au plus une convention ;
--    une convention regroupe plusieurs groupes. Pas de co-financement (à venir).
-- 4. Droits : l'administrateur gère tout (RLS). Le formateur n'a aucun accès.
--    L'organisme lit, sans pouvoir écrire, les conventions (hors brouillons) dont
--    un groupe concerne ses participants, par la fonction org_funding_conventions() :
--    elle ne renvoie ni le montant, ni les notes internes, ni le contact du financeur.
-- 5. Journal : chaque écriture est tracée par déclencheur (private.audit) ; les
--    exports (bilan PDF, CSV, BPF) par log_funding_export() (administrateur seul).
-- 6. Démonstration : une convention marquée is_demo disparaît avec son dernier
--    groupe (cascade depuis la purge des groupes démo), puis son financeur démo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Financeurs ───────────────────────────────────────────────────────────
create table public.funders (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 2 and 200),
  kind           text not null check (kind in (
    'france_travail', 'region', 'departement', 'etat', 'opco', 'fse_plus', 'mission_locale',
    'entreprise', 'particulier_cpf', 'fondation', 'autre_public', 'autre_prive')),
  contact_name   text check (contact_name is null or char_length(contact_name) <= 200),
  contact_email  text check (contact_email is null or (char_length(contact_email) <= 320 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  contact_phone  text check (contact_phone is null or char_length(contact_phone) <= 40),
  is_demo        boolean not null default false,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.funders is 'Financeurs des actions (France Travail, Région, OPCO, FSE+…). Administrateur uniquement.';
create unique index funders_name_kind_key on public.funders (lower(name), kind);

-- ── 2. Conventions ──────────────────────────────────────────────────────────
create table public.funding_conventions (
  id                            uuid primary key default gen_random_uuid(),
  funder_id                     uuid not null references public.funders (id) on delete restrict,
  reference                     text check (reference is null or char_length(reference) <= 120),
  title                         text not null check (char_length(title) between 2 and 200),
  start_date                    date not null,
  end_date                      date not null,
  planned_participants          integer not null check (planned_participants between 1 and 10000),
  planned_hours_per_participant numeric(6, 2) not null check (planned_hours_per_participant > 0 and planned_hours_per_participant <= 2000),
  amount_eur                    numeric(12, 2) check (amount_eur is null or (amount_eur >= 0 and amount_eur < 10000000000)),
  status                        text not null default 'brouillon' check (status in ('brouillon', 'en_cours', 'soldee')),
  notes                         text check (notes is null or char_length(notes) <= 4000),
  is_demo                       boolean not null default false,
  created_by                    uuid references public.profiles (id) on delete set null,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  constraint funding_conventions_period check (end_date >= start_date)
);
comment on table public.funding_conventions is 'Convention de financement ou marché : participants et heures conventionnés, période, statut. Montant et notes : administrateur uniquement.';
comment on column public.funding_conventions.reference is 'Numéro de convention, de marché ou de bon de commande du financeur.';
comment on column public.funding_conventions.planned_hours_per_participant is 'Durée prévue par participant, en heures (heures-stagiaires prévues = participants × durée).';
comment on column public.funding_conventions.amount_eur is 'Montant conventionné (€), facultatif. Jamais calculé ni estimé par l''application.';
create index funding_conventions_funder_idx on public.funding_conventions (funder_id);

-- ── 3. Groupes rattachés ────────────────────────────────────────────────────
create table public.funding_convention_groups (
  group_id       uuid primary key references public.groups (id) on delete cascade,
  convention_id  uuid not null references public.funding_conventions (id) on delete cascade,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
comment on table public.funding_convention_groups is 'Rattachement d''un groupe à sa convention de financement (un groupe : au plus une convention).';
create index funding_convention_groups_convention_idx on public.funding_convention_groups (convention_id);

-- ── Déclencheurs : normalisation ────────────────────────────────────────────
-- is_demo n'est posé que par la clé de service (scripts de démonstration) : un compte
-- connecté ne peut ni marquer ni démarquer une donnée de démonstration.
create or replace function private.funders_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.name := trim(new.name);
  new.contact_name := nullif(trim(new.contact_name), '');
  new.contact_email := nullif(lower(trim(new.contact_email)), '');
  new.contact_phone := nullif(trim(new.contact_phone), '');
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then new.is_demo := false; end if;
    new.created_by := coalesce((select auth.uid()), new.created_by);
    new.created_at := now();
  else
    if (select auth.uid()) is not null then new.is_demo := old.is_demo; end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger funders_guard before insert or update on public.funders
  for each row execute function private.funders_guard();

create or replace function private.funding_conventions_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.title := trim(new.title);
  new.reference := nullif(trim(new.reference), '');
  new.notes := nullif(trim(new.notes), '');
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then new.is_demo := false; end if;
    new.created_by := coalesce((select auth.uid()), new.created_by);
    new.created_at := now();
  else
    if (select auth.uid()) is not null then new.is_demo := old.is_demo; end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger funding_conventions_guard before insert or update on public.funding_conventions
  for each row execute function private.funding_conventions_guard();

create or replace function private.funding_convention_groups_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.group_id is distinct from old.group_id then
    raise exception 'Un rattachement ne peut pas être déplacé vers un autre groupe.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce((select auth.uid()), new.created_by);
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger funding_convention_groups_guard before insert or update on public.funding_convention_groups
  for each row execute function private.funding_convention_groups_guard();

-- ── Déclencheurs : journal d'activité (sans texte libre ni montant détaillé) ─
create or replace function private.funders_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row public.funders%rowtype;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  if tg_op = 'UPDATE' and new.name is not distinct from old.name and new.kind is not distinct from old.kind
     and new.contact_name is not distinct from old.contact_name and new.contact_email is not distinct from old.contact_email
     and new.contact_phone is not distinct from old.contact_phone then
    return null;
  end if;
  perform private.audit('funding.funder_' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    'funder', v_row.id::text, null, null,
    jsonb_build_object('name', v_row.name, 'kind', v_row.kind, 'is_demo', v_row.is_demo));
  return null;
end;
$$;
create trigger funders_audit after insert or update or delete on public.funders
  for each row execute function private.funders_audit();

create or replace function private.funding_conventions_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row public.funding_conventions%rowtype;
  v_changed text[];
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  if tg_op = 'UPDATE' then
    v_changed := array_remove(array[
      case when new.funder_id is distinct from old.funder_id then 'funder_id' end,
      case when new.reference is distinct from old.reference then 'reference' end,
      case when new.title is distinct from old.title then 'title' end,
      case when new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date then 'period' end,
      case when new.planned_participants is distinct from old.planned_participants then 'planned_participants' end,
      case when new.planned_hours_per_participant is distinct from old.planned_hours_per_participant then 'planned_hours_per_participant' end,
      case when new.amount_eur is distinct from old.amount_eur then 'amount_eur' end,
      case when new.status is distinct from old.status then 'status' end,
      case when new.notes is distinct from old.notes then 'notes' end
    ], null);
    if coalesce(array_length(v_changed, 1), 0) = 0 then return null; end if;
  end if;
  perform private.audit('funding.convention_' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    'funding_convention', v_row.id::text, null, null,
    jsonb_build_object('reference', v_row.reference, 'funder_id', v_row.funder_id, 'status', v_row.status,
      'previous_status', case when tg_op = 'UPDATE' then old.status end, 'changed', to_jsonb(v_changed), 'is_demo', v_row.is_demo));
  return null;
end;
$$;
create trigger funding_conventions_audit after insert or update or delete on public.funding_conventions
  for each row execute function private.funding_conventions_audit();

create or replace function private.funding_convention_groups_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row public.funding_convention_groups%rowtype;
  v_org uuid;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  if tg_op = 'UPDATE' and new.convention_id is not distinct from old.convention_id then return null; end if;
  select g.organization_id into v_org from public.groups g where g.id = v_row.group_id;
  perform private.audit(case tg_op when 'DELETE' then 'funding.group_detached' when 'INSERT' then 'funding.group_attached' else 'funding.group_moved' end,
    'funding_convention', v_row.convention_id::text, v_org, null,
    jsonb_build_object('group_id', v_row.group_id, 'previous_convention_id', case when tg_op = 'UPDATE' then old.convention_id end));
  return null;
end;
$$;
create trigger funding_convention_groups_audit after insert or update or delete on public.funding_convention_groups
  for each row execute function private.funding_convention_groups_audit();

-- ── Démonstration : purge en cascade ────────────────────────────────────────
-- La purge supprime les groupes démo ; leurs rattachements partent en cascade. Une
-- convention démo sans plus aucun groupe est alors supprimée, puis son financeur démo
-- s'il n'a plus de convention. Les données réelles ne sont jamais concernées.
create or replace function private.funding_demo_cleanup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'funding_convention_groups' then
    delete from public.funding_conventions c
    where c.id = old.convention_id and c.is_demo
      and not exists (select 1 from public.funding_convention_groups l where l.convention_id = c.id);
  else
    delete from public.funders f
    where f.id = old.funder_id and f.is_demo
      and not exists (select 1 from public.funding_conventions c where c.funder_id = f.id);
  end if;
  return null;
end;
$$;
create trigger funding_convention_groups_demo_cleanup after delete on public.funding_convention_groups
  for each row execute function private.funding_demo_cleanup();
create trigger funding_conventions_demo_cleanup after delete on public.funding_conventions
  for each row execute function private.funding_demo_cleanup();

-- ── RLS : administrateur uniquement ─────────────────────────────────────────
revoke all on public.funders, public.funding_conventions, public.funding_convention_groups from anon, authenticated;
grant select, insert, update, delete on public.funders, public.funding_conventions, public.funding_convention_groups to authenticated;

alter table public.funders enable row level security;
alter table public.funders force row level security;
alter table public.funding_conventions enable row level security;
alter table public.funding_conventions force row level security;
alter table public.funding_convention_groups enable row level security;
alter table public.funding_convention_groups force row level security;

create policy funders_admin on public.funders for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy funding_conventions_admin on public.funding_conventions for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy funding_convention_groups_admin on public.funding_convention_groups for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ── Lecture organisme (lecture seule, colonnes non financières) ─────────────
-- Conventions en cours ou soldées dont au moins un groupe concerne les participants de
-- la structure (private.org_sees_group : groupe de l'organisme ou participant rattaché,
-- abandons compris). Seuls ces groupes sont renvoyés. Permission org.impact.read requise.
create or replace function public.org_funding_conventions()
returns table (
  id uuid,
  reference text,
  title text,
  funder_name text,
  funder_kind text,
  start_date date,
  end_date date,
  planned_participants integer,
  planned_hours_per_participant numeric,
  status text,
  group_ids uuid[]
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.reference, c.title, f.name, f.kind, c.start_date, c.end_date, c.planned_participants,
         c.planned_hours_per_participant, c.status, array_agg(l.group_id order by l.group_id)
  from public.funding_conventions c
  join public.funders f on f.id = c.funder_id
  join public.funding_convention_groups l on l.convention_id = c.id
  where private.current_role_code() = 'organisme'
    and private.has_permission('org.impact.read')
    and c.status <> 'brouillon'
    and private.org_sees_group(l.group_id)
  group by c.id, f.id
  order by c.start_date desc, c.title;
$$;
revoke execute on function public.org_funding_conventions() from public, anon;
grant execute on function public.org_funding_conventions() to authenticated;

-- ── Journal des exports ─────────────────────────────────────────────────────
create or replace function public.log_funding_export(p_document text, p_convention_id uuid default null, p_year integer default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  if p_document not in ('bilan_action_pdf', 'bilan_action_pdf_nominatif', 'realisation_csv', 'bpf_csv') then
    raise exception 'Document non journalisable.' using errcode = '22023';
  end if;
  if p_document = 'bpf_csv' then
    if p_year is null or p_year not between 2000 and 2100 then
      raise exception 'Année invalide.' using errcode = '22023';
    end if;
    perform private.audit('export.bpf_csv', 'bpf', p_year::text, null, null, jsonb_build_object('year', p_year));
  else
    if p_convention_id is null or not exists (select 1 from public.funding_conventions c where c.id = p_convention_id) then
      raise exception 'Convention introuvable.' using errcode = 'P0002';
    end if;
    perform private.audit('export.funding_' || p_document, 'funding_convention', p_convention_id::text, null, null,
      jsonb_build_object('document', p_document));
  end if;
end;
$$;
revoke execute on function public.log_funding_export(text, uuid, integer) from public, anon;
grant execute on function public.log_funding_export(text, uuid, integer) to authenticated;
