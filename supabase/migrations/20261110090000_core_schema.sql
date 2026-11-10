-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — 1/7 : socle (rôles, profils, organismes, participants,
-- programmes, groupes, sessions, présences)
-- ════════════════════════════════════════════════════════════════════════════

-- Schéma privé : fonctions d'aide utilisées par les politiques RLS et les déclencheurs.
-- Il n'est pas exposé par l'API (PostgREST ne publie que le schéma public).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── Rôles et permissions ────────────────────────────────────────────────────
create table public.roles (
  code        text primary key check (code ~ '^[a-z_]+$'),
  label       text not null,
  description text,
  position    int  not null default 0
);
comment on table public.roles is 'Rôles applicatifs. Un utilisateur possède exactement un rôle (profiles.role).';

create table public.permissions (
  code             text primary key check (code ~ '^[a-z_.]+$'),
  label            text not null,
  description      text,
  applicable_roles text[] not null,
  position         int not null default 0
);
comment on table public.permissions is 'Permissions fines activables par rôle. applicable_roles borne les rôles auxquels une permission peut être accordée.';

create table public.role_permissions (
  role_code       text not null references public.roles (code) on delete cascade,
  permission_code text not null references public.permissions (code) on delete cascade,
  granted_by      uuid,
  granted_at      timestamptz not null default now(),
  primary key (role_code, permission_code)
);

-- ── Profils (1:1 avec auth.users) ───────────────────────────────────────────
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  role               text not null default 'participant' references public.roles (code),
  first_name         text not null default '' check (char_length(first_name) <= 80),
  last_name          text not null default '' check (char_length(last_name) <= 80),
  email              text not null,
  phone              text check (phone is null or char_length(phone) <= 30),
  status             text not null default 'active' check (status in ('active', 'disabled')),
  terms_accepted_at  timestamptz,
  privacy_consent_at timestamptz,
  consent_version    text,
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- ── Organismes (locataires de la plateforme) ────────────────────────────────
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 160),
  type          text not null default 'autre'
                check (type in ('mission_locale', 'france_travail', 'ecole', 'organisme_formation', 'structure_insertion', 'entreprise', 'autre')),
  siret         text check (siret is null or siret ~ '^[0-9]{14}$'),
  city          text check (city is null or char_length(city) <= 120),
  contact_email text,
  contact_phone text,
  status        text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'rejected')),
  status_reason text,
  validated_at  timestamptz,
  validated_by  uuid references public.profiles (id) on delete set null,
  created_by    uuid references public.profiles (id) on delete set null,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index organizations_status_idx on public.organizations (status);
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  member_role     text not null default 'member' check (member_role in ('owner', 'member')),
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id),
  -- Un compte organisme appartient à une seule structure : l'isolation reste simple à raisonner.
  unique (user_id)
);

-- ── Participants ────────────────────────────────────────────────────────────
create table public.participants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references public.profiles (id) on delete set null,
  first_name      text not null check (char_length(first_name) between 1 and 80),
  last_name       text not null check (char_length(last_name) between 1 and 80),
  email           text check (email is null or email = lower(email)),
  phone           text check (phone is null or char_length(phone) <= 30),
  organization_id uuid references public.organizations (id) on delete set null,
  status          text not null default 'active' check (status in ('invited', 'active', 'archived')),
  invited_by      uuid references public.profiles (id) on delete set null,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on column public.participants.organization_id is 'Rattachement actif. C''est lui qui ouvre l''accès en lecture aux membres de l''organisme.';
comment on column public.participants.user_id is 'Nul tant que la personne invitée n''a pas créé (et confirmé) son compte.';
create unique index participants_email_key on public.participants (email) where email is not null;
create index participants_organization_idx on public.participants (organization_id);
create index participants_name_idx on public.participants (lower(last_name), lower(first_name));
create trigger participants_set_updated_at before update on public.participants
  for each row execute function private.set_updated_at();

create table public.participant_organization_history (
  id                       bigint generated always as identity primary key,
  participant_id           uuid not null references public.participants (id) on delete cascade,
  organization_id          uuid references public.organizations (id) on delete set null,
  previous_organization_id uuid references public.organizations (id) on delete set null,
  changed_by               uuid references public.profiles (id) on delete set null,
  changed_at               timestamptz not null default now()
);
comment on table public.participant_organization_history is 'Historique des rattachements participant ↔ organisme.';
create index participant_org_history_participant_idx on public.participant_organization_history (participant_id, changed_at desc);

-- ── Programmes et trame des sessions ────────────────────────────────────────
create table public.programs (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null check (char_length(name) between 2 and 160),
  description              text,
  sessions_count           int  not null default 6 check (sessions_count between 1 and 24),
  session_duration_minutes int  not null default 180 check (session_duration_minutes between 15 and 600),
  min_group_size           int  not null default 4 check (min_group_size >= 1),
  max_group_size           int  not null default 8,
  status                   text not null default 'active' check (status in ('draft', 'active', 'archived')),
  is_public                boolean not null default false,
  is_demo                  boolean not null default false,
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (max_group_size >= min_group_size)
);
comment on column public.programs.is_public is 'Programme présenté sur le site vitrine (un seul à la fois).';
create unique index programs_single_public on public.programs (is_public) where is_public;
create trigger programs_set_updated_at before update on public.programs
  for each row execute function private.set_updated_at();

create table public.program_sessions (
  id             uuid primary key default gen_random_uuid(),
  program_id     uuid not null references public.programs (id) on delete cascade,
  number         int  not null check (number >= 1),
  title          text not null,
  summary        text,
  objectives     text[] not null default '{}',
  activities     text[] not null default '{}',
  key_notions    text[] not null default '{}',
  takeaways      text[] not null default '{}',
  is_provisional boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (program_id, number)
);
comment on column public.program_sessions.is_provisional is 'Contenu provisoire en attente des supports officiels.';
create trigger program_sessions_set_updated_at before update on public.program_sessions
  for each row execute function private.set_updated_at();

-- ── Groupes ─────────────────────────────────────────────────────────────────
create table public.groups (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 2 and 120),
  program_id      uuid not null references public.programs (id) on delete restrict,
  organization_id uuid references public.organizations (id) on delete set null,
  start_date      date,
  end_date        date,
  status          text not null default 'active' check (status in ('planned', 'active', 'completed', 'archived')),
  created_by      uuid references public.profiles (id) on delete set null,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);
create index groups_program_idx on public.groups (program_id);
create index groups_organization_idx on public.groups (organization_id);
create trigger groups_set_updated_at before update on public.groups
  for each row execute function private.set_updated_at();

create table public.group_trainers (
  group_id    uuid not null references public.groups (id) on delete cascade,
  trainer_id  uuid not null references public.profiles (id) on delete cascade,
  is_lead     boolean not null default false,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (group_id, trainer_id)
);
create index group_trainers_trainer_idx on public.group_trainers (trainer_id);

create table public.group_members (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.groups (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  status         text not null default 'active' check (status in ('active', 'removed')),
  joined_at      timestamptz not null default now(),
  left_at        timestamptz,
  added_by       uuid references public.profiles (id) on delete set null,
  unique (group_id, participant_id)
);
create index group_members_participant_idx on public.group_members (participant_id);

-- ── Sessions ────────────────────────────────────────────────────────────────
create table public.sessions (
  id                 uuid primary key default gen_random_uuid(),
  group_id           uuid not null references public.groups (id) on delete cascade,
  program_session_id uuid not null references public.program_sessions (id) on delete restrict,
  number             int  not null,
  scheduled_date     date,
  start_time         time,
  end_time           time,
  location           text check (location is null or char_length(location) <= 200),
  status             text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  trainer_id         uuid references public.profiles (id) on delete set null,
  started_at         timestamptz,
  completed_at       timestamptz,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (group_id, program_session_id),
  check (start_time is null or end_time is null or end_time > start_time)
);
create index sessions_group_idx on public.sessions (group_id, number);
create index sessions_date_idx on public.sessions (scheduled_date);
create trigger sessions_set_updated_at before update on public.sessions
  for each row execute function private.set_updated_at();

-- ── Présences ───────────────────────────────────────────────────────────────
create table public.attendance (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sessions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  status         text not null check (status in ('present', 'absent', 'late', 'left_early', 'excused')),
  comment        text check (comment is null or char_length(comment) <= 500),
  recorded_by    uuid references public.profiles (id) on delete set null,
  recorded_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (session_id, participant_id)
);
comment on column public.attendance.recorded_at is 'Heure de validation de la présence par le formateur.';
create index attendance_participant_idx on public.attendance (participant_id);

create table public.attendance_history (
  id             bigint generated always as identity primary key,
  attendance_id  uuid,
  session_id     uuid not null,
  participant_id uuid not null,
  old_status     text,
  new_status     text,
  old_comment    text,
  new_comment    text,
  changed_by     uuid,
  changed_at     timestamptz not null default now()
);
create index attendance_history_session_idx on public.attendance_history (session_id, changed_at desc);
