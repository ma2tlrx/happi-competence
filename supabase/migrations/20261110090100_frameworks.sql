-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — 2/7 : référentiels versionnés et questionnaires
--
-- Principe : un référentiel (framework) possède des versions. Une version en
-- brouillon est librement modifiable ; une version publiée est figée. Toute
-- évolution passe par une nouvelle version, ce qui préserve les évaluations
-- historiques.
-- ════════════════════════════════════════════════════════════════════════════

create table public.frameworks (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z_]+$'),
  name        text not null,
  short_name  text not null,
  description text,
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);
comment on table public.frameworks is 'Référentiels de compétences (ex. compétences transversales, habiletés socio-cognitives).';

create table public.framework_versions (
  id                  uuid primary key default gen_random_uuid(),
  framework_id        uuid not null references public.frameworks (id) on delete cascade,
  version_number      int  not null check (version_number >= 1),
  label               text not null,
  status              text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_provisional      boolean not null default false,
  notes               text,
  -- Échelle de notation
  scale_min           int not null,
  scale_max           int not null,
  scale_step          numeric(3, 2) not null default 1 check (scale_step in (0.5, 1)),
  -- Règles de calcul (voir src/lib/evaluation-engine)
  scoring_mode        text not null default 'direct' check (scoring_mode in ('direct', 'criteria_count', 'criteria_average')),
  aggregation         text not null default 'latest' check (aggregation in ('latest', 'mean', 'weighted_mean', 'max')),
  rounding            text not null default 'none' check (rounding in ('none', 'half', 'integer')),
  settings            jsonb not null default '{}'::jsonb,
  based_on_version_id uuid references public.framework_versions (id) on delete set null,
  published_at        timestamptz,
  published_by        uuid references public.profiles (id) on delete set null,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (framework_id, version_number),
  check (scale_max > scale_min)
);
comment on column public.framework_versions.is_provisional is 'Version en attente de validation pédagogique (signalée dans les interfaces).';
comment on column public.framework_versions.scoring_mode is 'direct : niveau saisi par compétence ; criteria_count : nombre de critères observés ; criteria_average : moyenne pondérée des critères notés.';
comment on column public.framework_versions.aggregation is 'Règle de synthèse entre sessions : dernière observation, moyenne, moyenne pondérée ou maximum.';
create trigger framework_versions_set_updated_at before update on public.framework_versions
  for each row execute function private.set_updated_at();

create table public.scale_levels (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.framework_versions (id) on delete cascade,
  value       int  not null,
  label       text not null,
  description text,
  unique (version_id, value)
);
comment on table public.scale_levels is 'Niveaux de maîtrise de l''échelle d''une version (libellé de chaque note).';

create table public.skill_categories (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.framework_versions (id) on delete cascade,
  code        text not null check (code ~ '^[a-z0-9_]+$'),
  name        text not null,
  description text,
  position    int  not null default 0,
  unique (version_id, code)
);

create table public.skills (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.framework_versions (id) on delete cascade,
  category_id uuid references public.skill_categories (id) on delete set null,
  code        text not null check (code ~ '^[a-z0-9_]+$'),
  name        text not null,
  description text,
  position    int  not null default 0,
  weight      numeric(6, 2) not null default 1 check (weight >= 0),
  is_active   boolean not null default true,
  unique (version_id, code)
);
comment on column public.skills.code is 'Identifiant stable d''une version à l''autre : il relie l''historique d''une même compétence.';
create index skills_category_idx on public.skills (category_id);

create table public.skill_level_descriptors (
  id          uuid primary key default gen_random_uuid(),
  skill_id    uuid not null references public.skills (id) on delete cascade,
  level_value int  not null,
  description text not null,
  unique (skill_id, level_value)
);
comment on table public.skill_level_descriptors is 'Description de chaque niveau de maîtrise pour une compétence donnée.';

create table public.skill_criteria (
  id          uuid primary key default gen_random_uuid(),
  skill_id    uuid not null references public.skills (id) on delete cascade,
  label       text not null,
  description text,
  position    int  not null default 0,
  weight      numeric(6, 2) not null default 1 check (weight >= 0),
  is_active   boolean not null default true
);
comment on table public.skill_criteria is 'Critères d''observation et indicateurs comportementaux associés à une compétence.';
create index skill_criteria_skill_idx on public.skill_criteria (skill_id, position);

create table public.session_skill_map (
  id             uuid primary key default gen_random_uuid(),
  version_id     uuid not null references public.framework_versions (id) on delete cascade,
  session_number int  not null check (session_number >= 1),
  skill_id       uuid not null references public.skills (id) on delete cascade,
  weight         numeric(6, 2) not null default 1 check (weight >= 0),
  unique (version_id, session_number, skill_id)
);
comment on table public.session_skill_map is 'Correspondance entre les sessions du programme et les compétences qui y sont évaluées.';

-- Référentiels activés pour un programme (une version par référentiel).
create table public.program_frameworks (
  program_id           uuid not null references public.programs (id) on delete cascade,
  framework_id         uuid not null references public.frameworks (id) on delete cascade,
  framework_version_id uuid not null references public.framework_versions (id) on delete restrict,
  activated_by         uuid references public.profiles (id) on delete set null,
  activated_at         timestamptz not null default now(),
  primary key (program_id, framework_id)
);

-- ── Questionnaires d'auto-évaluation ────────────────────────────────────────
create table public.questionnaires (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z_]+$'),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table public.questionnaire_versions (
  id               uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires (id) on delete cascade,
  version_number   int  not null check (version_number >= 1),
  label            text not null,
  status           text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_provisional   boolean not null default false,
  intro            text,
  scale_min        int not null default 1,
  scale_max        int not null default 5,
  published_at     timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (questionnaire_id, version_number),
  check (scale_max > scale_min)
);
-- Une seule version publiée par questionnaire : c'est celle proposée aux nouveaux participants.
create unique index questionnaire_versions_single_published
  on public.questionnaire_versions (questionnaire_id) where status = 'published';
create trigger questionnaire_versions_set_updated_at before update on public.questionnaire_versions
  for each row execute function private.set_updated_at();

create table public.questionnaire_scale_labels (
  version_id uuid not null references public.questionnaire_versions (id) on delete cascade,
  value      int  not null,
  label      text not null,
  primary key (version_id, value)
);

create table public.questionnaire_questions (
  id             uuid primary key default gen_random_uuid(),
  version_id     uuid not null references public.questionnaire_versions (id) on delete cascade,
  position       int  not null default 0,
  text           text not null,
  help           text,
  framework_code text,
  skill_code     text,
  is_active      boolean not null default true
);
comment on column public.questionnaire_questions.skill_code is 'Compétence visée (code stable), pour rapprocher auto-évaluation et observations.';
create index questionnaire_questions_version_idx on public.questionnaire_questions (version_id, position);
