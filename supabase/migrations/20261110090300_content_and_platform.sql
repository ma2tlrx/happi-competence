-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — 4/7 : contenus pédagogiques, lecteur, codes d'accès,
-- journal d'activité, notifications, contact, demandes RGPD, paramètres
-- ════════════════════════════════════════════════════════════════════════════

-- ── Supports pédagogiques (Markdown versionné, un support par session) ──────
create table public.pedagogical_contents (
  id                 uuid primary key default gen_random_uuid(),
  program_session_id uuid not null unique references public.program_sessions (id) on delete cascade,
  current_version_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger pedagogical_contents_set_updated_at before update on public.pedagogical_contents
  for each row execute function private.set_updated_at();

create table public.pedagogical_content_versions (
  id              uuid primary key default gen_random_uuid(),
  content_id      uuid not null references public.pedagogical_contents (id) on delete cascade,
  version_number  int  not null check (version_number >= 1),
  markdown        text not null check (char_length(markdown) between 1 and 400000),
  source_filename text,
  change_note     text,
  is_provisional  boolean not null default false,
  published_at    timestamptz,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (content_id, version_number)
);
comment on table public.pedagogical_content_versions is 'Chaque import crée une version ; les anciennes sont conservées et peuvent être republiées.';

alter table public.pedagogical_contents
  add constraint pedagogical_contents_current_version_fkey
  foreign key (current_version_id) references public.pedagogical_content_versions (id) on delete set null;

-- ── Lecteur pédagogique : reprise de session et notes privées ───────────────
create table public.session_player_states (
  session_id         uuid not null references public.sessions (id) on delete cascade,
  trainer_id         uuid not null references public.profiles (id) on delete cascade,
  content_version_id uuid references public.pedagogical_content_versions (id) on delete set null,
  current_block      int  not null default 0 check (current_block >= 0),
  completed_blocks   int[] not null default '{}',
  session_timer      jsonb not null default '{}'::jsonb,
  block_timers       jsonb not null default '{}'::jsonb,
  updated_at         timestamptz not null default now(),
  primary key (session_id, trainer_id)
);

create table public.trainer_notes (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  block_key  text not null default '' check (char_length(block_key) <= 120),
  body       text not null default '' check (char_length(body) <= 8000),
  updated_at timestamptz not null default now(),
  unique (trainer_id, session_id, block_key)
);
comment on table public.trainer_notes is 'Notes privées du formateur (visibles de lui seul). block_key vide = note générale de la session.';

-- Carnet personnel du participant : « Ce que j'ai appris » pour chaque session.
create table public.participant_session_notes (
  participant_id uuid not null references public.participants (id) on delete cascade,
  session_id     uuid not null references public.sessions (id) on delete cascade,
  learned        text not null default '' check (char_length(learned) <= 4000),
  updated_at     timestamptz not null default now(),
  primary key (participant_id, session_id)
);

-- ── Codes d'accès à usage unique ────────────────────────────────────────────
-- Le code n'est jamais stocké en clair : seule son empreinte SHA-256 est conservée.
create table public.invitation_codes (
  id              uuid primary key default gen_random_uuid(),
  code_hash       text not null unique,
  code_hint       text not null,
  role            text not null references public.roles (code) check (role in ('admin', 'formateur', 'organisme')),
  organization_id uuid references public.organizations (id) on delete cascade,
  label           text check (label is null or char_length(label) <= 160),
  expires_at      timestamptz,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  used_at         timestamptz,
  used_by         uuid references public.profiles (id) on delete set null,
  revoked_at      timestamptz,
  revoked_by      uuid references public.profiles (id) on delete set null,
  check ((role = 'organisme') = (organization_id is not null))
);
comment on column public.invitation_codes.code_hint is 'Quatre derniers caractères du code, pour l''identifier sans le révéler.';

-- ── Journal d'activité (ajout seul) ─────────────────────────────────────────
create table public.audit_logs (
  id              bigint generated always as identity primary key,
  occurred_at     timestamptz not null default now(),
  actor_id        uuid,
  actor_role      text,
  action          text not null,
  entity_type     text,
  entity_id       text,
  organization_id uuid,
  participant_id  uuid,
  metadata        jsonb not null default '{}'::jsonb
);
comment on table public.audit_logs is 'Journal des actions sensibles. Identifiants uniquement, sans donnée nominative ; ni modification ni suppression.';
create index audit_logs_occurred_idx on public.audit_logs (occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);
create index audit_logs_action_idx on public.audit_logs (action, occurred_at desc);

-- ── Notifications ───────────────────────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ── Messages du formulaire de contact ───────────────────────────────────────
create table public.contact_messages (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 120),
  email        text not null check (char_length(email) between 5 and 254),
  organization text check (organization is null or char_length(organization) <= 160),
  audience     text check (audience is null or audience in ('participant', 'organisme', 'entreprise', 'autre')),
  message      text not null check (char_length(message) between 10 and 4000),
  consent_at   timestamptz not null default now(),
  origin_hash  text,
  status       text not null default 'new' check (status in ('new', 'read', 'archived')),
  handled_by   uuid references public.profiles (id) on delete set null,
  handled_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index contact_messages_created_idx on public.contact_messages (created_at desc);

-- ── Demandes relatives aux données personnelles (RGPD) ──────────────────────
create table public.data_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            text not null check (type in ('export', 'deletion')),
  status          text not null default 'pending' check (status in ('pending', 'completed', 'rejected', 'cancelled')),
  details         text check (details is null or char_length(details) <= 2000),
  resolution_note text,
  processed_by    uuid references public.profiles (id) on delete set null,
  processed_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index data_requests_user_idx on public.data_requests (user_id, created_at desc);

-- ── Paramètres de la plateforme ─────────────────────────────────────────────
create table public.app_settings (
  key        text primary key check (key ~ '^[a-z_.]+$'),
  value      jsonb not null,
  is_public  boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
comment on column public.app_settings.is_public is 'Paramètre lisible par le site vitrine (mentions légales, coordonnées).';
