-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — Jeux d'animation (Quiz en direct et Undercover)
--
-- Reprise du « Site de Quizz » dans l'application. Les jeux sont des OUTILS D'ANIMATION :
-- ils n'alimentent ni évaluations, ni passeports, ni statistiques d'impact.
--
-- Qui fait quoi :
--   - créer, éditer, animer : formateur et administrateur, permission `games.manage`
--     (accordée par défaut au formateur ; l'administrateur a toutes les permissions) ;
--   - rejoindre une partie : public (code ou lien + pseudo, sans compte). Ces joueurs ne
--     passent JAMAIS par la base avec leurs droits : les routes publiques de l'application
--     utilisent la clé de service, valident le code, limitent le débit et ne renvoient ni
--     bonnes réponses ni rôles.
--
-- Données :
--   game_quizzes / game_questions         bibliothèque du formateur (propriétaire = profil)
--   game_sessions / game_session_players  parties de Quiz et scores finaux (pseudo seul)
--   game_states                           état vivant d'une partie de Quiz (réponses comprises)
--   game_undercover_games                 état vivant d'une partie d'Undercover (rôles et mots)
--   game_undercover_configs               paires de mots enregistrées par le formateur
--
-- Les deux tables d'état ne sont accessibles qu'au serveur (clé de service) : aucune politique,
-- aucun droit pour les rôles `anon` et `authenticated`. Durée de vie 24 h (Quiz) et 4 h
-- (Undercover), purgée par public.purge_expired_games().
--
-- Journal d'activité : les déclencheurs n'écrivent que des identifiants, des états et des
-- compteurs — jamais un titre, un mot, une question ni un pseudo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Permission ───────────────────────────────────────────────────────────
insert into public.permissions (code, label, description, applicable_roles, position) values
  ('games.manage', 'Créer et animer des jeux',
   'Créer des quiz et des parties d’Undercover, lancer et animer une partie en direct. Les joueurs, eux, rejoignent sans compte.',
   '{formateur,admin}', 30)
on conflict (code) do nothing;

insert into public.role_permissions (role_code, permission_code) values
  ('formateur', 'games.manage'),
  ('admin', 'games.manage')
on conflict do nothing;

-- Droit de gérer les jeux : permission accordée au rôle de l'appelant (l'administrateur a tout).
create or replace function private.can_manage_games()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_permission('games.manage')
     and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'active');
$$;

-- ── 2. Quiz et questions ────────────────────────────────────────────────────
create table public.game_quizzes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  theme_color text not null default '#EA632E' check (theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.game_quizzes is 'Quiz d''animation du formateur. Outil d''animation : aucun lien avec les évaluations.';
create index game_quizzes_owner_idx on public.game_quizzes (owner_id, created_at desc);
create trigger game_quizzes_set_updated_at before update on public.game_quizzes
  for each row execute function private.set_updated_at();

create table public.game_questions (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.game_quizzes (id) on delete cascade,
  -- Un brouillon peut avoir un énoncé vide : la partie ne se lance que sur des questions complètes (contrôlé par le serveur).
  text       text not null check (char_length(text) <= 300),
  type       text not null default 'multiple_choice' check (type in ('multiple_choice', 'true_false', 'multiple_select')),
  time_limit integer not null default 20 check (time_limit between 5 and 300),
  position   integer not null default 0 check (position >= 0),
  -- Adresse https ou chemin du site ; vide : pas d'image.
  image_url  text check (image_url is null or (char_length(image_url) <= 500 and image_url ~ '^(https://[^[:space:]]+|/[A-Za-z0-9/_.-]+)$')),
  -- [{ "id": uuid, "text": "…", "isCorrect": bool }] — lu par le serveur seulement côté joueur.
  answers    jsonb not null default '[]'::jsonb
             check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) <= 8)
);
comment on column public.game_questions.answers is 'Réponses [{id, text, isCorrect}] : ne sort jamais vers un joueur avant la fin de la question.';
create index game_questions_quiz_idx on public.game_questions (quiz_id, position);

-- ── 3. Parties de Quiz ──────────────────────────────────────────────────────
create table public.game_sessions (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.game_quizzes (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  code        text not null check (code ~ '^[A-Z2-9]{6}$'),
  status      text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  max_players integer not null default 10 check (max_players between 2 and 50),
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
comment on table public.game_sessions is 'Partie de Quiz : code de salle, statut. L''état vivant est dans game_states.';
-- Le code ne doit être unique que parmi les parties en cours : un code de partie terminée se réutilise.
create unique index game_sessions_open_code_idx on public.game_sessions (code) where status <> 'finished';
create index game_sessions_owner_idx on public.game_sessions (owner_id, created_at desc);
create index game_sessions_quiz_idx on public.game_sessions (quiz_id);

create table public.game_session_players (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  nickname   text not null check (char_length(btrim(nickname)) between 2 and 24),
  score      integer not null default 0 check (score >= 0),
  -- SHA-256 du jeton remis au joueur à son entrée : il prouve qu'une réponse vient de lui.
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  joined_at  timestamptz not null default now()
);
comment on table public.game_session_players is 'Joueurs d''une partie : pseudo seul (aucune autre donnée personnelle) et score final.';
create unique index game_session_players_nick_idx on public.game_session_players (session_id, lower(nickname));
create index game_session_players_session_idx on public.game_session_players (session_id, joined_at);

-- ── 4. États vivants (serveur seulement) ────────────────────────────────────
-- `version` porte le verrou optimiste : une écriture n'aboutit que si la version lue est encore
-- la version courante (voir src/lib/jeux/state-store.ts).
create table public.game_states (
  id         uuid primary key references public.game_sessions (id) on delete cascade,
  state      jsonb not null,
  version    bigint not null default 1,
  expires_at timestamptz not null
);
comment on table public.game_states is 'État vivant d''une partie de Quiz (réponses attendues comprises). Serveur seulement, durée de vie 24 h.';
create index game_states_expires_idx on public.game_states (expires_at);

create table public.game_undercover_games (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  code       text not null check (code ~ '^[A-Z2-9]{6}$'),
  state      jsonb not null,
  version    bigint not null default 1,
  expires_at timestamptz not null
);
comment on table public.game_undercover_games is 'État vivant d''une partie d''Undercover (rôles et mots secrets compris). Serveur seulement, durée de vie 4 h.';
create unique index game_undercover_games_code_idx on public.game_undercover_games (code);
create index game_undercover_games_owner_idx on public.game_undercover_games (owner_id);
create index game_undercover_games_expires_idx on public.game_undercover_games (expires_at);

-- ── 5. Paires de mots enregistrées ──────────────────────────────────────────
create table public.game_undercover_configs (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references public.profiles (id) on delete cascade,
  name                 text not null check (char_length(btrim(name)) between 1 and 80),
  civil_word           text not null check (char_length(btrim(civil_word)) between 1 and 60),
  undercover_word      text not null check (char_length(btrim(undercover_word)) between 1 and 60),
  include_mister_white boolean not null default true,
  created_at           timestamptz not null default now()
);
comment on table public.game_undercover_configs is 'Configurations Undercover du formateur (paire de mots, rôle « Fourmi Caché »).';
create index game_undercover_configs_owner_idx on public.game_undercover_configs (owner_id, created_at desc);

-- ── 6. RLS ──────────────────────────────────────────────────────────────────
alter table public.game_quizzes enable row level security;
alter table public.game_quizzes force row level security;
alter table public.game_questions enable row level security;
alter table public.game_questions force row level security;
alter table public.game_sessions enable row level security;
alter table public.game_sessions force row level security;
alter table public.game_session_players enable row level security;
alter table public.game_session_players force row level security;
alter table public.game_states enable row level security;
alter table public.game_states force row level security;
alter table public.game_undercover_games enable row level security;
alter table public.game_undercover_games force row level security;
alter table public.game_undercover_configs enable row level security;
alter table public.game_undercover_configs force row level security;

-- Propriétaire (avec la permission) ou administrateur.
create policy game_quizzes_select on public.game_quizzes for select to authenticated
  using ((select private.can_manage_games()) and (owner_id = (select auth.uid()) or (select private.is_admin())));
create policy game_quizzes_insert on public.game_quizzes for insert to authenticated
  with check ((select private.can_manage_games()) and owner_id = (select auth.uid()));
create policy game_quizzes_update on public.game_quizzes for update to authenticated
  using ((select private.can_manage_games()) and (owner_id = (select auth.uid()) or (select private.is_admin())))
  with check ((select private.can_manage_games()) and (owner_id = (select auth.uid()) or (select private.is_admin())));
create policy game_quizzes_delete on public.game_quizzes for delete to authenticated
  using ((select private.can_manage_games()) and (owner_id = (select auth.uid()) or (select private.is_admin())));

-- Questions : les droits suivent ceux du quiz (la sous-requête passe elle-même par la RLS du quiz).
create policy game_questions_select on public.game_questions for select to authenticated
  using ((select private.can_manage_games()) and exists (select 1 from public.game_quizzes q where q.id = quiz_id));
create policy game_questions_insert on public.game_questions for insert to authenticated
  with check ((select private.can_manage_games()) and exists (select 1 from public.game_quizzes q where q.id = quiz_id));
create policy game_questions_update on public.game_questions for update to authenticated
  using ((select private.can_manage_games()) and exists (select 1 from public.game_quizzes q where q.id = quiz_id))
  with check ((select private.can_manage_games()) and exists (select 1 from public.game_quizzes q where q.id = quiz_id));
create policy game_questions_delete on public.game_questions for delete to authenticated
  using ((select private.can_manage_games()) and exists (select 1 from public.game_quizzes q where q.id = quiz_id));

-- Parties : le propriétaire crée (sur un quiz qu'il peut voir : le sien, ou n'importe lequel pour l'administrateur), lit et supprime ; le statut est piloté par le serveur.
create policy game_sessions_select on public.game_sessions for select to authenticated
  using ((select private.can_manage_games()) and (owner_id = (select auth.uid()) or (select private.is_admin())));
create policy game_sessions_insert on public.game_sessions for insert to authenticated
  with check (
    (select private.can_manage_games()) and owner_id = (select auth.uid())
    and exists (select 1 from public.game_quizzes q where q.id = quiz_id)
  );
create policy game_sessions_delete on public.game_sessions for delete to authenticated
  using ((select private.can_manage_games()) and (owner_id = (select auth.uid()) or (select private.is_admin())));

-- Joueurs : lecture par le propriétaire de la partie ; écriture par le serveur uniquement.
create policy game_session_players_select on public.game_session_players for select to authenticated
  using ((select private.can_manage_games()) and exists (select 1 from public.game_sessions s where s.id = session_id));

-- Configurations Undercover.
create policy game_undercover_configs_select on public.game_undercover_configs for select to authenticated
  using ((select private.can_manage_games()) and (owner_id = (select auth.uid()) or (select private.is_admin())));
create policy game_undercover_configs_insert on public.game_undercover_configs for insert to authenticated
  with check ((select private.can_manage_games()) and owner_id = (select auth.uid()));
create policy game_undercover_configs_update on public.game_undercover_configs for update to authenticated
  using ((select private.can_manage_games()) and (owner_id = (select auth.uid()) or (select private.is_admin())))
  with check ((select private.can_manage_games()) and (owner_id = (select auth.uid()) or (select private.is_admin())));
create policy game_undercover_configs_delete on public.game_undercover_configs for delete to authenticated
  using ((select private.can_manage_games()) and (owner_id = (select auth.uid()) or (select private.is_admin())));

-- Droits de table (explicites : aucun droit par défaut). game_states et game_undercover_games :
-- AUCUNE politique (RLS forcée) et aucun droit pour anon / authenticated : le joueur ne lit jamais
-- ces tables, tout passe par les routes du serveur (clé de service).
grant execute on function private.can_manage_games() to authenticated, service_role;
grant select, insert, delete on public.game_quizzes to authenticated;
grant update (title, description, theme_color) on public.game_quizzes to authenticated;
grant select, insert, update, delete on public.game_questions to authenticated;
-- Parties : créées par le propriétaire sur son quiz ; statut et code ne sont changés que par le serveur.
grant select, insert, delete on public.game_sessions to authenticated;
-- Joueurs : pseudo et score lisibles par le propriétaire ; le jeton (empreinte) ne l'est par personne côté client.
grant select (id, session_id, nickname, score, joined_at) on public.game_session_players to authenticated;
grant select, insert, update, delete on public.game_undercover_configs to authenticated;
grant all on public.game_quizzes, public.game_questions, public.game_sessions, public.game_session_players,
  public.game_states, public.game_undercover_games, public.game_undercover_configs to service_role;

-- ── 7. Journal d'activité (identifiants et compteurs, jamais de texte libre ni de pseudo) ──
create or replace function private.game_quizzes_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.audit('game_quiz.created', 'game_quiz', new.id::text, null, null, jsonb_build_object('owner_id', new.owner_id));
    return new;
  elsif tg_op = 'DELETE' then
    perform private.audit('game_quiz.deleted', 'game_quiz', old.id::text, null, null, jsonb_build_object('owner_id', old.owner_id));
    return old;
  end if;
  return new;
end;
$$;
create trigger game_quizzes_audit after insert or delete on public.game_quizzes
  for each row execute function private.game_quizzes_audit();

create or replace function private.game_sessions_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.audit('game_session.created', 'game_session', new.id::text, null, null,
      jsonb_build_object('owner_id', new.owner_id, 'quiz_id', new.quiz_id, 'max_players', new.max_players));
  elsif new.status is distinct from old.status then
    perform private.audit('game_session.' || new.status, 'game_session', new.id::text, null, null,
      jsonb_build_object('owner_id', new.owner_id, 'players', (select count(*) from public.game_session_players p where p.session_id = new.id)));
  end if;
  return new;
end;
$$;
create trigger game_sessions_audit after insert or update on public.game_sessions
  for each row execute function private.game_sessions_audit();

create or replace function private.game_undercover_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.audit('game_undercover.created', 'game_undercover', new.id::text, null, null, jsonb_build_object('owner_id', new.owner_id));
    return new;
  end if;
  return old;
end;
$$;
create trigger game_undercover_audit after insert on public.game_undercover_games
  for each row execute function private.game_undercover_audit();

create or replace function private.game_undercover_configs_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.audit('game_undercover_config.created', 'game_undercover_config', new.id::text, null, null, jsonb_build_object('owner_id', new.owner_id));
    return new;
  end if;
  perform private.audit('game_undercover_config.deleted', 'game_undercover_config', old.id::text, null, null, jsonb_build_object('owner_id', old.owner_id));
  return old;
end;
$$;
create trigger game_undercover_configs_audit after insert or delete on public.game_undercover_configs
  for each row execute function private.game_undercover_configs_audit();

-- ── 8. Purge des états expirés ──────────────────────────────────────────────
-- Appelée par l'application (à la création d'une partie) et par la tâche planifiée.
-- Les parties de Quiz dont l'état a expiré sans avoir été terminées sont closes.
create or replace function public.purge_expired_games()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_states integer;
  v_undercover integer;
  v_closed integer;
begin
  if (select auth.role()) is distinct from 'service_role' and not private.is_admin() then
    raise exception 'Réservé au serveur.' using errcode = '42501';
  end if;

  with expired as (
    delete from public.game_states where expires_at < now() returning id
  ), closed as (
    update public.game_sessions s set status = 'finished', finished_at = coalesce(s.finished_at, now())
     where s.id in (select id from expired) and s.status <> 'finished'
    returning s.id
  )
  select (select count(*) from expired), (select count(*) from closed) into v_states, v_closed;

  with gone as (delete from public.game_undercover_games where expires_at < now() returning id)
  select count(*) into v_undercover from gone;

  return jsonb_build_object('quiz_states', v_states, 'quiz_sessions_closed', v_closed, 'undercover_games', v_undercover);
end;
$$;
revoke all on function public.purge_expired_games() from public, anon, authenticated;
grant execute on function public.purge_expired_games() to service_role;

-- ── 9. Enregistrement des questions d'un quiz (une seule transaction) ───────
-- Remplace toutes les questions du quiz : un échec en cours de route n'en perd aucune.
-- SECURITY INVOKER : les politiques RLS de l'appelant s'appliquent (quiz du propriétaire seulement).
create or replace function public.save_game_questions(p_quiz_id uuid, p_questions jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) > 100 then
    raise exception 'Liste de questions invalide.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.game_quizzes q where q.id = p_quiz_id) then
    raise exception 'Quiz introuvable.' using errcode = 'P0002';
  end if;
  delete from public.game_questions where quiz_id = p_quiz_id;
  insert into public.game_questions (quiz_id, text, type, time_limit, position, image_url, answers)
  select p_quiz_id,
         coalesce(q ->> 'text', ''),
         coalesce(q ->> 'type', 'multiple_choice'),
         coalesce((q ->> 'timeLimit')::integer, 20),
         (ord - 1)::integer,
         nullif(q ->> 'imageUrl', ''),
         coalesce(q -> 'answers', '[]'::jsonb)
  from jsonb_array_elements(p_questions) with ordinality as t (q, ord);
end;
$$;
revoke all on function public.save_game_questions(uuid, jsonb) from public, anon;
grant execute on function public.save_game_questions(uuid, jsonb) to authenticated, service_role;
