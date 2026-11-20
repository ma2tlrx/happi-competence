'use client';

import { ArrowRight, Hourglass, LogOut, Vote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';

import { CodeBadge } from '@/components/jeux/shared/code-badge';
import { GameHeading, GamePanel, GameStage } from '@/components/jeux/shared/game-shell';
import { LiveRegion } from '@/components/jeux/shared/live-region';
import { PlayerChip } from '@/components/jeux/shared/player-chip';
import { useHydrated } from '@/components/public/use-motion-preference';
import { usePolledResource } from '@/components/jeux/shared/use-polled-resource';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import {
  NICKNAME_MAX,
  clearIdentity,
  clearPendingNickname,
  nicknameError,
  parseIdentity,
  readIdentityRaw,
  readPendingNickname,
  saveIdentity,
  subscribeIdentity,
  undercoverApi,
  type GameIdentity,
  type PublicGame,
  type UndercoverRole,
} from '@/lib/jeux/client-undercover';
import { activePlayers, currentSpeaker, pluralFr, voteKey } from '@/lib/jeux/undercover-view';

import { EliminationResult, GameOverSummary, LobbyPlayers, SpeakingOrder, VoteProgress } from './parts';
import { PeekCard, RoleCard } from './role-card';

/** Écran du joueur (téléphone) : salon d'attente, rôle en privé, parole, vote, résultat. Page publique. */
export function UndercoverPlayer({ gameId }: { gameId: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const raw = useSyncExternalStore(subscribeIdentity, () => readIdentityRaw(gameId), () => null);
  const identity = useMemo(() => parseIdentity(raw), [raw]);
  const isHost = identity?.host === true;

  useEffect(() => {
    // L'animateur dispose de son propre écran : jamais d'écran joueur (donc jamais de rôle) sur son appareil.
    if (hydrated && isHost) router.replace(`/jeux/undercover/partie/${gameId}`);
  }, [hydrated, isHost, gameId, router]);

  if (!hydrated || isHost) return <Centered message="Chargement de la partie…" />;
  if (!identity) return <JoinGate gameId={gameId} />;
  return <PlayerGame key={identity.playerId} gameId={gameId} identity={identity} />;
}

function Centered({ message }: { message: string }) {
  return (
    <GameStage className="my-auto py-10 text-center">
      <p role="status" className="text-lg text-white/80">
        {message}
      </p>
    </GameStage>
  );
}

/** Arrivée sur la page sans identité : rejoint avec le pseudo saisi sur /jouer, ou le demande ici. */
function JoinGate({ gameId }: { gameId: string }) {
  const [pending] = useState(() => readPendingNickname(gameId));
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(Boolean(pending));
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function join(pseudo: string) {
    const result = await undercoverApi.join(gameId, pseudo);
    clearPendingNickname(gameId);
    if (result.ok) {
      saveIdentity(gameId, { playerId: result.data.playerId, token: result.data.playerToken, host: false });
      return;
    }
    setBusy(false);
    setError(
      result.status === 409 ? 'Impossible de rejoindre : la partie a commencé, elle est complète ou ce pseudo est déjà pris.' : result.error,
    );
  }

  useEffect(() => {
    if (!pending || started.current) return;
    started.current = true;
    void join(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule tentative, avec le pseudo reçu de /jouer
  }, [pending]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = nicknameError(nickname);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    void join(nickname.trim());
  }

  if (busy && pending && !error) return <Centered message="Connexion à la partie…" />;
  return (
    <GameStage className="my-auto py-6">
      <GameHeading eyebrow="Fourmi Caché" title="Rejoindre cette partie" className="mb-6" />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-xl bg-white p-5 text-ink shadow-lg">
        <Field label="Votre pseudo" hint="Visible des autres joueurs." error={error}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                setError(null);
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              maxLength={NICKNAME_MAX}
              autoComplete="nickname"
              autoFocus
              className="h-14 text-lg"
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={busy}>
          Rejoindre
          <ArrowRight aria-hidden />
        </Button>
      </form>
      <LiveRegion message={error ?? ''} assertive />
    </GameStage>
  );
}

type RoleInfo = { startedAt: number | undefined; role: UndercoverRole; word: string | null };

function PlayerGame({ gameId, identity }: { gameId: string; identity: GameIdentity }) {
  const router = useRouter();
  const { data: game, error: pollError, setData } = usePolledResource<PublicGame>(
    () => undercoverApi.get(gameId).then((result) => (result.ok ? { ok: true as const, data: result.data.game } : result)),
    2000,
  );
  const [roleInfo, setRoleInfo] = useState<RoleInfo | null>(null);
  const [roleAttempt, setRoleAttempt] = useState(0);
  const [vote, setVote] = useState<{ key: string; targetId: string } | null>(null);
  const [guess, setGuess] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = game?.players[identity.playerId];
  const status = game?.status;
  const startedAt = game?.startedAt;
  const inGame = Boolean(me);

  // Le rôle n'est demandé qu'à partir du lancement, uniquement pour ce joueur, avec son jeton. Il se renouvelle à chaque nouvelle partie.
  useEffect(() => {
    if (!inGame || !status || status === 'lobby') return;
    if (roleInfo && roleInfo.startedAt === startedAt) return;
    let cancelled = false;
    undercoverApi.myRole(gameId, { playerId: identity.playerId, playerToken: identity.token }).then((result) => {
      if (cancelled) return;
      if (result.ok) setRoleInfo({ startedAt, role: result.data.role, word: result.data.word });
      else window.setTimeout(() => setRoleAttempt((value) => value + 1), 1500);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, identity.playerId, identity.token, inGame, status, startedAt, roleInfo, roleAttempt]);

  async function run(action: () => Promise<{ ok: true; game: PublicGame } | { ok: false; error: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) setData(result.game);
    else setError(result.error);
  }

  function leave() {
    clearIdentity(gameId);
    router.push('/jouer');
  }

  if (pollError && !game) {
    return (
      <GameStage className="my-auto py-8 text-center">
        <GameHeading title={pollError.status === 404 ? 'Partie introuvable' : 'Connexion impossible'} />
        <p className="mt-3 text-white/80">
          {pollError.status === 404 ? 'Cette partie n’existe plus ou a expiré (les parties sont effacées au bout de 24 h).' : pollError.message}
        </p>
        <Button className="mt-6" size="lg" variant="inverse" onClick={leave}>
          Rejoindre une autre partie
        </Button>
      </GameStage>
    );
  }
  if (!game) return <Centered message="Chargement de la partie…" />;

  if (!me) {
    return (
      <GameStage className="my-auto py-8 text-center">
        <GameHeading title="Vous n’êtes plus dans cette partie" />
        <p className="mt-3 text-white/80">Elle a peut-être déjà commencé sans vous. Demandez à l’animateur de la relancer, puis rejoignez-la de nouveau.</p>
        <Button className="mt-6" size="lg" variant="inverse" onClick={leave}>
          Rejoindre une partie
        </Button>
      </GameStage>
    );
  }

  const role = roleInfo && roleInfo.startedAt === startedAt ? roleInfo : null;
  const speaker = currentSpeaker(game);
  const key = voteKey(game);
  const hasVoted = vote?.key === key;
  const lastRound = game.roundResults[game.roundResults.length - 1];
  const candidates = activePlayers(game).filter(
    (player) => player.id !== identity.playerId && (!game.tiebreakPlayerIds || game.tiebreakPlayerIds.includes(player.id)),
  );
  const totalVoters = activePlayers(game).length;
  const iAmSpy = role?.role === 'spy';
  const canPeek = Boolean(role) && !me.isEliminated && (game.status === 'discussion' || game.status === 'voting');

  function submitVote(targetId: string) {
    void run(async () => {
      const result = await undercoverApi.vote(gameId, { voterId: identity.playerId, targetId, playerToken: identity.token });
      if (!result.ok) return { ok: false, error: result.error };
      setVote({ key, targetId });
      return { ok: true, game: result.data.game };
    });
  }

  function submitGuess(event: FormEvent) {
    event.preventDefault();
    if (!guess.trim()) return;
    void run(async () => {
      const result = await undercoverApi.spyGuess(gameId, { spyId: identity.playerId, playerToken: identity.token, guess: guess.trim() });
      return result.ok ? { ok: true, game: result.data.game } : { ok: false, error: result.error };
    });
  }

  const announcement = (() => {
    switch (game.status) {
      case 'lobby':
        return `${pluralFr(game.playerCount, 'joueur')} dans le salon d’attente.`;
      case 'role_reveal':
        return 'La partie commence. Consultez votre rôle en privé.';
      case 'discussion':
        return speaker?.id === identity.playerId ? `Manche ${game.currentRound}. C’est à vous de parler.` : `Manche ${game.currentRound}. C’est à ${speaker?.nickname ?? 'un joueur'} de parler.`;
      case 'voting':
        return game.tiebreakPlayerIds ? 'Égalité. Nouveau vote entre les joueurs à égalité.' : 'C’est l’heure du vote.';
      case 'vote_result':
        return lastRound?.eliminatedNickname ? `${lastRound.eliminatedNickname} est éliminé.` : 'Égalité : personne n’est éliminé.';
      case 'spy_guess':
        return 'L’Espion a été éliminé : il peut tenter de deviner le mot des Civils.';
      case 'game_over':
        return 'La partie est terminée.';
    }
  })();

  return (
    <GameStage className="py-2">
      <LiveRegion message={announcement} />
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-white">Fourmi Caché</p>
          {game.status !== 'lobby' && game.status !== 'role_reveal' && game.status !== 'game_over' ? (
            <p className="text-sm text-white/70">Manche {game.currentRound}</p>
          ) : null}
        </div>
        <CodeBadge code={game.code} />
      </header>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      {game.status === 'lobby' ? (
        <section aria-labelledby="titre-salon" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h1 id="titre-salon" className="font-display text-xl font-semibold text-white">
              Salon d’attente
            </h1>
            <span className="text-sm text-white/70">
              {game.playerCount} / {game.maxPlayers}
            </span>
          </div>
          <LobbyPlayers game={game} selfId={identity.playerId} />
          <p className="flex items-center justify-center gap-2 py-3 text-white/80">
            <Hourglass className="size-4" aria-hidden />
            En attente du lancement par l’animateur…
          </p>
          <Button variant="inverse" size="lg" onClick={leave}>
            <LogOut aria-hidden />
            Quitter la partie
          </Button>
        </section>
      ) : null}

      {game.status === 'role_reveal' ? (
        <section aria-labelledby="titre-role" className="flex flex-col items-center gap-5">
          <h1 id="titre-role" className="text-center font-display text-xl font-semibold text-white">
            Regardez votre téléphone discrètement
          </h1>
          {role ? <RoleCard key={role.startedAt} role={role.role} word={role.word} /> : <p className="py-10 text-white/80">Chargement de votre rôle…</p>}
          <p className="text-center text-sm text-white/70">Quand tout le monde a vu son rôle, l’animateur lance la discussion.</p>
        </section>
      ) : null}

      {game.status === 'discussion' ? (
        <section aria-labelledby="titre-parole" className="flex flex-col gap-5">
          <div className="text-center">
            <h1 id="titre-parole" className="text-sm font-medium text-white/80">
              Tour de parole
            </h1>
            <GamePanel className="mt-2 p-4">
              <p className="text-sm text-white/70">Joueur actuel</p>
              <p className="font-display text-2xl font-semibold text-white">
                {speaker?.nickname ?? '—'}
                {speaker?.id === identity.playerId ? <span className="ml-2 text-base font-normal text-orange-200">(vous)</span> : null}
              </p>
            </GamePanel>
            <p className="mt-3 text-sm text-white/75">Décrivez votre mot en une phrase, sans le prononcer directement.</p>
          </div>
          <SpeakingOrder game={game} selfId={identity.playerId} />
          <p className="text-center text-sm text-white/70">L’animateur fait passer la parole au joueur suivant.</p>
        </section>
      ) : null}

      {game.status === 'voting' ? (
        <section aria-labelledby="titre-vote" className="flex flex-col gap-5">
          <div className="text-center">
            <h1 id="titre-vote" className="font-display text-2xl font-semibold text-white">
              {game.tiebreakPlayerIds ? 'Égalité : revotez' : 'Vote'}
            </h1>
            <p className="mt-1 text-white/80">
              {me.isEliminated
                ? 'Vous êtes éliminé : vous ne pouvez plus voter.'
                : hasVoted
                  ? 'Vote enregistré. Attendez les autres joueurs.'
                  : game.tiebreakPlayerIds
                    ? 'Départagez les joueurs à égalité.'
                    : 'Désignez le joueur à éliminer.'}
            </p>
          </div>
          <VoteProgress received={game.voteCount} total={totalVoters} />
          {!me.isEliminated && !hasVoted ? (
            <ul className="grid gap-2" aria-label="Joueurs pour qui voter">
              {candidates.map((player) => (
                <li key={player.id}>
                  <PlayerChip nickname={player.nickname} onSelect={() => submitVote(player.id)} disabled={busy} />
                </li>
              ))}
            </ul>
          ) : null}
          {hasVoted && !me.isEliminated ? (
            <GamePanel className="text-center">
              <Vote className="mx-auto size-8 text-orange-300" aria-hidden />
              <p className="mt-2 font-semibold text-white">Vote enregistré</p>
              <p className="text-sm text-white/80">
                Vous avez voté contre <strong className="text-white">{vote ? (game.players[vote.targetId]?.nickname ?? '?') : '?'}</strong>.
              </p>
            </GamePanel>
          ) : null}
        </section>
      ) : null}

      {game.status === 'vote_result' && lastRound ? (
        <section aria-labelledby="titre-resultat" className="flex flex-col gap-5">
          <h1 id="titre-resultat" className="sr-only">
            Résultat du vote
          </h1>
          <EliminationResult game={game} round={lastRound} />
          <p className="text-center text-white/80">En attente de la manche suivante…</p>
        </section>
      ) : null}

      {game.status === 'spy_guess' ? (
        <section aria-labelledby="titre-espion" className="flex flex-col gap-5">
          <div className="text-center">
            <h1 id="titre-espion" className="font-display text-2xl font-semibold text-white">
              Dernière chance
            </h1>
            <p className="mt-1 text-white/80">
              {iAmSpy ? 'Vous avez été éliminé. Devinez le mot des Civils pour gagner.' : 'L’Espion a été éliminé : il tente de deviner le mot des Civils.'}
            </p>
          </div>
          {iAmSpy ? (
            <form onSubmit={submitGuess} className="flex flex-col gap-3 rounded-xl bg-white p-5 text-ink">
              <Field label="Le mot des Civils">
                {({ id, describedBy }) => (
                  <Input id={id} aria-describedby={describedBy} value={guess} onChange={(event) => setGuess(event.target.value)} autoComplete="off" autoFocus className="h-14 text-lg" />
                )}
              </Field>
              <Button type="submit" size="lg" loading={busy} disabled={!guess.trim()}>
                Valider ma réponse
              </Button>
            </form>
          ) : (
            <p className="rounded-xl border border-white/15 bg-white/[0.06] p-5 text-center text-white/80">L’Espion réfléchit…</p>
          )}
        </section>
      ) : null}

      {game.status === 'game_over' ? (
        <section aria-labelledby="titre-fin" className="flex flex-col gap-5">
          <h1 id="titre-fin" className="sr-only">
            Fin de la partie
          </h1>
          <GameOverSummary game={game} />
          <p className="text-center text-white/80">Si l’animateur relance une partie, vous reviendrez automatiquement au salon d’attente.</p>
          <Button variant="inverse" size="lg" onClick={leave}>
            <LogOut aria-hidden />
            Quitter
          </Button>
        </section>
      ) : null}

      {canPeek && role ? <PeekCard role={role.role} word={role.word} /> : null}
    </GameStage>
  );
}
