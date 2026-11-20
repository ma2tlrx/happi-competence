-- ════════════════════════════════════════════════════════════════════════════
-- HAPPI Compétence — Jeux : joueurs identifiés par leur compte, résultats conservés
--
-- Décisions du propriétaire (remplacent celles de 20261120100000_games.sql) :
--   - on ne joue plus sans compte : seuls les participants connectés jouent ; l'identité vient de la
--     session (cookies), plus d'un jeton de joueur. Un formateur ou un administrateur peut « essayer »
--     un jeu (mode essai) : aucun résultat n'est alors enregistré ;
--   - à la fin d'une partie, une ligne par participant est conservée dans game_results (indicateurs),
--     retrouvable dans son profil. Ces lignes n'alimentent NI le bilan, NI le passeport, NI le CV de
--     compétences, NI le tableau d'impact, NI les exports financeurs : aucune requête existante ne les lit ;
--   - le pseudo n'est jamais conservé dans game_results.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Joueurs d'une partie de Quiz : identité du compte ────────────────────
-- Le jeton (et son empreinte) disparaît : l'identité du joueur est celle de la session connectée.
alter table public.game_session_players drop column token_hash;

alter table public.game_session_players
  add column profile_id     uuid references public.profiles (id) on delete cascade,
  add column participant_id uuid references public.participants (id) on delete cascade,
  add column is_trial       boolean not null default false;

comment on column public.game_session_players.profile_id is 'Compte du joueur (session connectée). Sert à retrouver sa place après une déconnexion.';
comment on column public.game_session_players.participant_id is 'Fiche participant : renseignée pour un participant, vide pour un animateur en mode essai.';
comment on column public.game_session_players.is_trial is 'Mode essai (animateur) : aucun résultat n''est enregistré.';

-- Anciennes lignes (joueurs anonymes) tolérées ; toute nouvelle ligne doit désigner un compte, et un
-- participant ne peut pas être en mode essai.
alter table public.game_session_players
  add constraint game_session_players_identity_chk
  check (profile_id is not null and (is_trial = (participant_id is null))) not valid;

create unique index game_session_players_profile_idx on public.game_session_players (session_id, profile_id) where profile_id is not null;
create index game_session_players_participant_idx on public.game_session_players (participant_id) where participant_id is not null;

-- ── 2. Résultats conservés ──────────────────────────────────────────────────
create table public.game_results (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  game_type      text not null check (game_type in ('quiz', 'undercover')),
  -- Identifiant de la partie (session de Quiz ou partie d'Undercover) : sans clé étrangère, le résultat
  -- survit à la suppression du quiz ou à l'expiration de l'état de la partie.
  game_ref       uuid not null,
  -- Une partie d'Undercover peut être rejouée avec les mêmes joueurs : une manche de jeu = un numéro.
  play_index     integer not null default 1 check (play_index >= 1),
  played_at      timestamptz not null default now(),
  -- Joueurs de la partie, animateurs en mode essai exclus.
  player_count   integer not null check (player_count >= 1),
  -- Quiz : rang (1 = premier) et score ; null pour Undercover.
  rank           integer check (rank is null or rank >= 1),
  score          integer check (score is null or score >= 0),
  question_count integer check (question_count is null or question_count >= 0),
  answered_count integer check (answered_count is null or answered_count >= 0),
  correct_answers integer check (correct_answers is null or correct_answers >= 0),
  avg_response_ms integer check (avg_response_ms is null or avg_response_ms >= 0),
  -- Undercover : rôle tenu, issue, manches survécues.
  role           text check (role is null or role in ('civil', 'undercover', 'spy')),
  outcome        text check (outcome is null or outcome in ('won', 'lost')),
  rounds_survived integer check (rounds_survived is null or rounds_survived >= 0),
  -- Titre du quiz, ou thème d'Undercover : jamais les mots secrets, jamais un pseudo.
  title          text check (title is null or char_length(title) <= 120),
  created_at     timestamptz not null default now(),
  constraint game_results_quiz_chk check (game_type <> 'quiz' or (rank is not null and score is not null)),
  constraint game_results_undercover_chk check (game_type <> 'undercover' or (role is not null and outcome is not null)),
  constraint game_results_answers_chk check (correct_answers is null or answered_count is null or correct_answers <= answered_count),
  -- Idempotence : enregistrer deux fois la fin d'une partie ne duplique rien.
  constraint game_results_once unique (participant_id, game_type, game_ref, play_index)
);
comment on table public.game_results is
  'Résultats de jeux d''animation (une ligne par participant et par partie). Hors bilan, hors passeport, hors impact : aucune lecture par ces modules. Écrit par le serveur seulement ; ni pseudo ni mot secret.';
create index game_results_participant_idx on public.game_results (participant_id, played_at desc);

alter table public.game_results enable row level security;
alter table public.game_results force row level security;

-- Lecture : le participant (les siens), le formateur d'un groupe où il est inscrit, l'administrateur.
-- L'organisme n'a PAS accès (décision prudente, à valider). Aucune écriture côté client.
create policy game_results_select on public.game_results for select to authenticated
  using (
    participant_id = (select private.my_participant_id())
    or (select private.is_admin())
    or (select private.trains_participant(participant_id))
  );

revoke all on public.game_results from anon, authenticated;
grant select on public.game_results to authenticated;
grant all on public.game_results to service_role;

-- ── 3. Journal d'activité : un événement par lot de résultats, sans nom ni pseudo ──
create or replace function private.game_results_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in select game_type, game_ref, count(*) as n from new_rows group by game_type, game_ref loop
    perform private.audit('game_results.recorded', 'game_results', r.game_ref::text, null, null,
      jsonb_build_object('game_type', r.game_type, 'results', r.n));
  end loop;
  return null;
end;
$$;
create trigger game_results_audit after insert on public.game_results
  referencing new table as new_rows
  for each statement execute function private.game_results_audit();

-- ── 4. Conservation : purge des anciens résultats (à planifier) ─────────────
-- Durée proposée : 24 mois (à valider, voir docs/conformite/registre-traitements.md). Réservée au serveur.
create or replace function public.purge_old_game_results(p_retention interval default interval '24 months')
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if (select auth.role()) is distinct from 'service_role' and not private.is_admin() then
    raise exception 'Réservé au serveur.' using errcode = '42501';
  end if;
  if p_retention < interval '1 month' then
    raise exception 'Durée de conservation trop courte.' using errcode = '22023';
  end if;
  with gone as (delete from public.game_results where played_at < now() - p_retention returning 1)
  select count(*) into v_count from gone;
  return v_count;
end;
$$;
revoke all on function public.purge_old_game_results(interval) from public, anon, authenticated;
grant execute on function public.purge_old_game_results(interval) to service_role;
