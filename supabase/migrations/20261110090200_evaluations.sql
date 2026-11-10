-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — 3/7 : auto-évaluations et évaluations des formateurs
-- ════════════════════════════════════════════════════════════════════════════

-- ── Auto-évaluations (conservées indépendamment des évaluations formateur) ──
create table public.self_assessments (
  id                       uuid primary key default gen_random_uuid(),
  participant_id           uuid not null references public.participants (id) on delete cascade,
  questionnaire_version_id uuid not null references public.questionnaire_versions (id) on delete restrict,
  kind                     text not null default 'initial' check (kind in ('initial', 'intermediate', 'final')),
  status                   text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  comment                  text check (comment is null or char_length(comment) <= 2000),
  started_at               timestamptz not null default now(),
  completed_at             timestamptz,
  unique (participant_id, questionnaire_version_id, kind)
);
create index self_assessments_participant_idx on public.self_assessments (participant_id);

create table public.self_assessment_answers (
  id                 uuid primary key default gen_random_uuid(),
  self_assessment_id uuid not null references public.self_assessments (id) on delete cascade,
  question_id        uuid not null references public.questionnaire_questions (id) on delete restrict,
  value              int  not null,
  comment            text check (comment is null or char_length(comment) <= 1000),
  answered_at        timestamptz not null default now(),
  unique (self_assessment_id, question_id)
);

-- ── Évaluations des formateurs ──────────────────────────────────────────────
create table public.evaluations (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.sessions (id) on delete restrict,
  participant_id     uuid not null references public.participants (id) on delete cascade,
  evaluator_id       uuid references public.profiles (id) on delete set null,
  status             text not null default 'draft' check (status in ('draft', 'validated')),
  validated_at       timestamptz,
  validated_by       uuid references public.profiles (id) on delete set null,
  -- Photographie des référentiels appliqués, figée à la validation : rend l'évaluation
  -- relisible et reproductible indépendamment des tables de référence.
  framework_snapshot jsonb,
  revision           int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (session_id, participant_id),
  check ((status = 'validated') = (validated_at is not null))
);
comment on column public.evaluations.revision is 'Nombre de modifications apportées après validation (chacune est tracée dans evaluation_history).';
create index evaluations_participant_idx on public.evaluations (participant_id, status);
create trigger evaluations_set_updated_at before update on public.evaluations
  for each row execute function private.set_updated_at();

-- Versions de référentiels utilisées par une évaluation (fixées à sa création).
create table public.evaluation_frameworks (
  evaluation_id        uuid not null references public.evaluations (id) on delete cascade,
  framework_version_id uuid not null references public.framework_versions (id) on delete restrict,
  primary key (evaluation_id, framework_version_id)
);

create table public.evaluation_scores (
  id            uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  skill_id      uuid not null references public.skills (id) on delete restrict,
  score         numeric(4, 2),
  score_source  text not null default 'direct' check (score_source in ('direct', 'derived')),
  comment       text check (comment is null or char_length(comment) <= 1500),
  updated_at    timestamptz not null default now(),
  unique (evaluation_id, skill_id)
);
comment on column public.evaluation_scores.score is 'Note attribuée sur l''échelle de la version. Nul = compétence non observée.';
comment on column public.evaluation_scores.score_source is 'direct : saisie par le formateur ; derived : calculée à partir des critères selon la règle de la version.';
create index evaluation_scores_skill_idx on public.evaluation_scores (skill_id);

create table public.evaluation_criterion_scores (
  id            uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  criterion_id  uuid not null references public.skill_criteria (id) on delete restrict,
  observed      boolean,
  score         numeric(4, 2),
  unique (evaluation_id, criterion_id)
);

create table public.evaluation_comments (
  id            uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  kind          text not null check (kind in ('observation', 'advice', 'private')),
  body          text not null check (char_length(body) between 1 and 4000),
  author_id     uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (evaluation_id, kind)
);
comment on column public.evaluation_comments.kind is 'observation et advice sont partagés avec le participant ; private reste réservé aux formateurs.';

-- Journal des modifications : validation, puis toute correction ultérieure
-- (auteur, date, ancienne et nouvelle valeur, motif). Table en ajout seul.
create table public.evaluation_history (
  id            bigint generated always as identity primary key,
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  change_type   text not null check (change_type in ('validated', 'score', 'score_comment', 'criterion', 'comment')),
  skill_id      uuid,
  criterion_id  uuid,
  comment_kind  text,
  old_value     text,
  new_value     text,
  reason        text,
  changed_by    uuid,
  changed_at    timestamptz not null default now()
);
create index evaluation_history_evaluation_idx on public.evaluation_history (evaluation_id, changed_at desc);
