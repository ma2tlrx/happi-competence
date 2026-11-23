-- Points en direct (lecteur pédagogique) : aide-mémoire horodatés du formateur.
-- Un « + » = « cette personne s'est démarquée à cet instant », rattaché au bloc du support et au temps écoulé.
-- AIDE-MÉMOIRE UNIQUEMENT : aucun score, niveau ou barème n'est créé ; rien n'entre dans le bilan.
-- Lecture/écriture/suppression : formateurs de CETTE session et administrateurs. Jamais le participant ni l'organisme.

create table if not exists public.session_live_marks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  skill_code text check (skill_code is null or (skill_code ~ '^[a-z0-9_]+$' and char_length(skill_code) <= 80)),
  kind text not null default 'plus' check (kind in ('plus')),
  block_index integer check (block_index is null or block_index between 0 and 500),
  block_title text check (block_title is null or char_length(block_title) <= 200),
  elapsed_seconds integer check (elapsed_seconds is null or elapsed_seconds between 0 and 86400),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

comment on table public.session_live_marks is
  'Points en direct : aide-mémoire horodatés du formateur pendant l''animation (bloc du support, minutes écoulées). Aucun score ; jamais lisible par le participant ni par l''organisme.';

create index if not exists session_live_marks_session_idx on public.session_live_marks (session_id, created_at);
create index if not exists session_live_marks_participant_idx on public.session_live_marks (participant_id);
create index if not exists session_live_marks_created_by_idx on public.session_live_marks (created_by);

-- Le participant fait-il bien partie du groupe de la session ?
create or replace function private.live_mark_participant_ok(p_session_id uuid, p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.sessions s
    join public.group_members gm on gm.group_id = s.group_id
    where s.id = p_session_id and gm.participant_id = p_participant_id
  );
$$;

revoke all on function private.live_mark_participant_ok(uuid, uuid) from public, anon;
grant execute on function private.live_mark_participant_ok(uuid, uuid) to authenticated;

alter table public.session_live_marks enable row level security;
alter table public.session_live_marks force row level security;

drop policy if exists session_live_marks_select on public.session_live_marks;
create policy session_live_marks_select on public.session_live_marks for select to authenticated using (
  (select private.is_admin()) or private.trains_group(private.session_group_id(session_id))
);

drop policy if exists session_live_marks_insert on public.session_live_marks;
create policy session_live_marks_insert on public.session_live_marks for insert to authenticated with check (
  created_by = (select auth.uid())
  and ((select private.is_admin()) or private.trains_group(private.session_group_id(session_id)))
  and private.live_mark_participant_ok(session_id, participant_id)
);

drop policy if exists session_live_marks_delete on public.session_live_marks;
create policy session_live_marks_delete on public.session_live_marks for delete to authenticated using (
  (select private.is_admin()) or private.trains_group(private.session_group_id(session_id))
);

revoke all on public.session_live_marks from public, anon, authenticated;
grant select, insert, delete on public.session_live_marks to authenticated;
