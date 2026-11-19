-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — correspondance avec les référentiels publics (chantier F4)
--
-- « Parler le langage des conseillers et des employeurs » : rapprocher les
-- compétences HAPPI des savoir-être professionnels de France Travail (ROME 4.0)
-- et des compétences transversales ESCO. Voir docs/referentiels-publics.md.
--
-- 1. external_frameworks : référentiels externes (code, nom, éditeur, version,
--    adresse de la source, licence, date de récupération).
-- 2. external_skills : leurs éléments (code ou URI, libellé, définition si la
--    source en fournit une). Alimentés par scripts/import-referentiels-publics.mjs
--    à partir de fichiers officiels téléchargés ; AUCUN contenu n'est saisi ici.
-- 3. skill_mappings : correspondance compétence HAPPI ↔ élément externe, avec un
--    type de lien (équivalent / proche / partiel) et un statut (proposée / validée).
--
-- Règle pédagogique : la correspondance est une décision du propriétaire. Une
-- correspondance naît toujours « proposée » ; seul un administrateur identifié
-- (auth.uid() non nul) peut la valider — ni la clé de service, ni un script.
-- Seules les correspondances validées sont visibles hors administration.
--
-- La compétence HAPPI est désignée par son référentiel et son code stable
-- (skills.code) : la correspondance survit aux nouvelles versions du référentiel,
-- comme l'historique des évaluations. Aucun niveau ni aucun score n'est touché.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Référentiels externes ────────────────────────────────────────────────
create table public.external_frameworks (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  name         text not null check (char_length(name) between 2 and 160),
  publisher    text not null check (char_length(publisher) between 2 and 160),
  version      text not null check (char_length(version) between 1 and 40),
  source_url   text not null check (char_length(source_url) <= 500 and source_url ~ '^https://'),
  license      text not null check (char_length(license) between 2 and 300),
  retrieved_on date not null,
  notes        text check (notes is null or char_length(notes) <= 2000),
  position     int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.external_frameworks is 'Référentiels publics de compétences (ex. savoir-être professionnels ROME 4.0, compétences transversales ESCO), importés depuis leur source officielle.';
comment on column public.external_frameworks.retrieved_on is 'Date de téléchargement ou de consultation de la source officielle.';
create trigger external_frameworks_set_updated_at before update on public.external_frameworks
  for each row execute function private.set_updated_at();

-- ── 2. Éléments des référentiels externes ───────────────────────────────────
create table public.external_skills (
  id           uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.external_frameworks (id) on delete cascade,
  code         text not null check (char_length(code) between 1 and 300),
  label        text not null check (char_length(label) between 1 and 300),
  definition   text check (definition is null or char_length(definition) <= 4000),
  -- Élément absent du dernier import : conservé (les correspondances restent lisibles), signalé.
  is_active    boolean not null default true,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (framework_id, code)
);
comment on column public.external_skills.code is 'Identifiant fourni par la source (code ROME, URI ESCO…), jamais inventé.';
comment on column public.external_skills.definition is 'Définition telle que fournie par la source ; nulle si la source n''en donne pas.';
create index external_skills_framework_idx on public.external_skills (framework_id, position);
create trigger external_skills_set_updated_at before update on public.external_skills
  for each row execute function private.set_updated_at();

-- ── 3. Correspondances HAPPI ↔ externe ──────────────────────────────────────
create table public.skill_mappings (
  id                uuid primary key default gen_random_uuid(),
  framework_id      uuid not null references public.frameworks (id) on delete cascade,
  skill_code        text not null check (skill_code ~ '^[a-z0-9_]+$'),
  external_skill_id uuid not null references public.external_skills (id) on delete cascade,
  link_type         text not null check (link_type in ('equivalent', 'close', 'partial')),
  status            text not null default 'proposed' check (status in ('proposed', 'validated')),
  -- 'label_match' : pré-remplie par le script d'import (libellé identique ou quasi identique).
  origin            text not null default 'manual' check (origin in ('manual', 'label_match')),
  justification     text check (justification is null or char_length(justification) <= 1000),
  proposed_by       uuid references public.profiles (id) on delete set null,
  proposed_at       timestamptz not null default now(),
  validated_by      uuid references public.profiles (id) on delete set null,
  validated_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (framework_id, skill_code, external_skill_id),
  check (status = 'proposed' or validated_at is not null),
  check (origin = 'manual' or justification is not null)
);
comment on table public.skill_mappings is 'Correspondances entre une compétence HAPPI (référentiel + code stable) et un élément d''un référentiel public. Décision pédagogique de l''administrateur.';
comment on column public.skill_mappings.link_type is 'equivalent : même compétence ; close : proche ; partial : recouvrement partiel.';
comment on column public.skill_mappings.status is 'proposed : à examiner (invisible hors administration) ; validated : validée par un administrateur identifié.';
create index skill_mappings_skill_idx on public.skill_mappings (framework_id, skill_code);
create index skill_mappings_external_idx on public.skill_mappings (external_skill_id);
create index skill_mappings_validated_idx on public.skill_mappings (status) where status = 'validated';
create trigger skill_mappings_set_updated_at before update on public.skill_mappings
  for each row execute function private.set_updated_at();

-- Garde-fou : naissance « proposée », validation horodatée par la base et réservée à un
-- administrateur identifié, compétence HAPPI existante, cible immuable.
create or replace function private.skill_mappings_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'proposed' then
      raise exception 'Une correspondance est d’abord proposée, puis validée par un administrateur.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.skills s join public.framework_versions v on v.id = s.version_id
      where v.framework_id = new.framework_id and s.code = new.skill_code
    ) then
      raise exception 'Compétence HAPPI inconnue pour ce référentiel.' using errcode = '22023';
    end if;
    new.proposed_by := (select auth.uid());
    new.proposed_at := now();
    new.validated_by := null;
    new.validated_at := null;
    return new;
  end if;

  if new.framework_id <> old.framework_id or new.skill_code <> old.skill_code or new.external_skill_id <> old.external_skill_id then
    raise exception 'Une correspondance ne change pas de cible : retirez-la puis proposez-en une autre.' using errcode = '22023';
  end if;
  new.origin := old.origin;
  new.proposed_by := old.proposed_by;
  new.proposed_at := old.proposed_at;

  if new.status = 'validated' and old.status = 'proposed' then
    if (select auth.uid()) is null or not private.is_admin() then
      raise exception 'Seul un administrateur identifié peut valider une correspondance.' using errcode = '42501';
    end if;
    new.validated_by := (select auth.uid());
    new.validated_at := now();
  elsif new.status = 'validated' then
    -- Correspondance déjà validée : la décision n'est pas réécrite en silence.
    if new.link_type <> old.link_type or new.justification is distinct from old.justification then
      raise exception 'Repassez la correspondance en « proposée » avant de la modifier.' using errcode = '22023';
    end if;
    new.validated_by := old.validated_by;
    new.validated_at := old.validated_at;
  else
    new.validated_by := null;
    new.validated_at := null;
  end if;
  return new;
end;
$$;
create trigger skill_mappings_guard before insert or update on public.skill_mappings
  for each row execute function private.skill_mappings_guard();

-- ── 4. Journal (private.audit) ──────────────────────────────────────────────
create or replace function private.external_frameworks_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row public.external_frameworks;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  perform private.audit(
    case tg_op when 'INSERT' then 'external_framework.created' when 'UPDATE' then 'external_framework.updated' else 'external_framework.deleted' end,
    'external_framework', v_row.id::text, null, null,
    jsonb_build_object('code', v_row.code, 'version', v_row.version, 'retrieved_on', v_row.retrieved_on)
  );
  return null;
end;
$$;
create trigger external_frameworks_audit after insert or update or delete on public.external_frameworks
  for each row execute function private.external_frameworks_audit();

-- Éléments : une ligne de journal par import (instruction), pas une par élément.
create or replace function private.external_skills_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
  v_frameworks jsonb;
begin
  if tg_op = 'DELETE' then
    select count(*)::int, coalesce(jsonb_agg(distinct framework_id), '[]'::jsonb) into v_count, v_frameworks from old_rows;
  else
    select count(*)::int, coalesce(jsonb_agg(distinct framework_id), '[]'::jsonb) into v_count, v_frameworks from new_rows;
  end if;
  if v_count = 0 then return null; end if;
  perform private.audit(
    case tg_op when 'INSERT' then 'external_skills.imported' when 'UPDATE' then 'external_skills.updated' else 'external_skills.deleted' end,
    'external_framework', null, null, null,
    jsonb_build_object('count', v_count, 'frameworks', v_frameworks)
  );
  return null;
end;
$$;
create trigger external_skills_audit_insert after insert on public.external_skills
  referencing new table as new_rows for each statement execute function private.external_skills_audit();
create trigger external_skills_audit_update after update on public.external_skills
  referencing new table as new_rows for each statement execute function private.external_skills_audit();
create trigger external_skills_audit_delete after delete on public.external_skills
  referencing old table as old_rows for each statement execute function private.external_skills_audit();

create or replace function private.skill_mappings_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row public.skill_mappings;
  v_action text;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  v_action := case
    when tg_op = 'INSERT' then 'skill_mapping.proposed'
    when tg_op = 'DELETE' then 'skill_mapping.removed'
    when new.status = 'validated' and old.status = 'proposed' then 'skill_mapping.validated'
    when new.status = 'proposed' and old.status = 'validated' then 'skill_mapping.unvalidated'
    else 'skill_mapping.updated'
  end;
  if tg_op = 'UPDATE' and v_action = 'skill_mapping.updated'
     and new.link_type = old.link_type and new.justification is not distinct from old.justification then
    return null;
  end if;
  perform private.audit(
    v_action, 'skill_mapping', v_row.id::text, null, null,
    jsonb_build_object(
      'framework_id', v_row.framework_id, 'skill_code', v_row.skill_code, 'external_skill_id', v_row.external_skill_id,
      'link_type', v_row.link_type, 'status', v_row.status, 'origin', v_row.origin
    ) || case when tg_op = 'UPDATE' and new.link_type <> old.link_type then jsonb_build_object('previous_link_type', old.link_type) else '{}'::jsonb end
  );
  return null;
end;
$$;
create trigger skill_mappings_audit after insert or update or delete on public.skill_mappings
  for each row execute function private.skill_mappings_audit();

-- ── 5. Droits ───────────────────────────────────────────────────────────────
revoke all on public.external_frameworks, public.external_skills, public.skill_mappings from anon, authenticated;
grant select, insert, update, delete on public.external_frameworks, public.external_skills, public.skill_mappings to authenticated;
grant all on public.external_frameworks, public.external_skills, public.skill_mappings to service_role;

alter table public.external_frameworks enable row level security;
alter table public.external_frameworks force row level security;
alter table public.external_skills enable row level security;
alter table public.external_skills force row level security;
alter table public.skill_mappings enable row level security;
alter table public.skill_mappings force row level security;

-- Référentiels publics : lecture pour tout utilisateur connecté ; écriture réservée à l'administrateur.
create policy external_frameworks_select on public.external_frameworks for select to authenticated using (true);
create policy external_frameworks_insert on public.external_frameworks for insert to authenticated with check ((select private.is_admin()));
create policy external_frameworks_update on public.external_frameworks for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy external_frameworks_delete on public.external_frameworks for delete to authenticated using ((select private.is_admin()));

create policy external_skills_select on public.external_skills for select to authenticated using (true);
create policy external_skills_insert on public.external_skills for insert to authenticated with check ((select private.is_admin()));
create policy external_skills_update on public.external_skills for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy external_skills_delete on public.external_skills for delete to authenticated using ((select private.is_admin()));

-- Correspondances : hors administration, seules les validées sont lisibles.
create policy skill_mappings_select on public.skill_mappings for select to authenticated
  using (status = 'validated' or (select private.is_admin()));
create policy skill_mappings_insert on public.skill_mappings for insert to authenticated with check ((select private.is_admin()));
create policy skill_mappings_update on public.skill_mappings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy skill_mappings_delete on public.skill_mappings for delete to authenticated using ((select private.is_admin()));

grant execute on function private.skill_mappings_guard() to authenticated, service_role;
grant execute on function private.external_frameworks_audit() to authenticated, service_role;
grant execute on function private.external_skills_audit() to authenticated, service_role;
grant execute on function private.skill_mappings_audit() to authenticated, service_role;
