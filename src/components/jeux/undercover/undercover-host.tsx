'use client';

import { ArrowRight, Ban, ChevronLeft, Play, RotateCcw, ShieldCheck, Vote } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';

import { CodeBadge } from '@/components/jeux/shared/code-badge';
import { GamePanel, GameStage } from '@/components/jeux/shared/game-shell';
import { JoinQr } from '@/components/jeux/shared/join-qr';
import { LiveRegion } from '@/components/jeux/shared/live-region';
import { usePolledResource } from '@/components/jeux/shared/use-polled-resource';
import { Button, buttonClasses } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/overlays';
import { Notice } from '@/components/ui/primitives';
import { undercoverApi, type ApiResult, type PublicGame } from '@/lib/jeux/client-undercover';
import { activePlayers, currentSpeaker, isLastSpeaker, pluralFr } from '@/lib/jeux/undercover-view';
import { cn } from '@/lib/utils';

import { EliminationResult, GameOverSummary, LobbyPlayers, SpeakingOrder, VoteProgress } from './parts';

const MIN_PLAYERS = 3;
const noSubscription = () => () => {};

/**
 * Écran de l'animateur, pensé pour le projecteur. Il n'affiche jamais le rôle ou le mot d'un joueur
 * avant la fin de la partie (ces informations ne quittent le serveur que pour le joueur concerné).
 * Les commandes passent par le compte connecté : le serveur vérifie qu'il est propriétaire de la partie.
 */
export function UndercoverHost({ gameId }: { gameId: string }) {
  return <HostGame gameId={gameId} />;
}

function HostGame({ gameId }: { gameId: string }) {
  const router = useRouter();
  const origin = useSyncExternalStore(noSubscription, () => window.location.origin, () => '');
  const { data: game, error: pollError, setData } = usePolledResource<PublicGame>(
    () => undercoverApi.get(gameId).then((result) => (result.ok ? { ok: true as const, data: result.data.game } : result)),
    2000,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function run(action: () => Promise<ApiResult<{ game: PublicGame }>>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) setData(result.data.game);
    else setError(result.error);
  }

  async function cancel() {
    setBusy(true);
    const result = await undercoverApi.cancel(gameId);
    if (result.ok) {
      router.push('/jeux/undercover');
      return;
    }
    setBusy(false);
    setConfirmCancel(false);
    setError(result.error);
  }

  if (pollError && !game) {
    return (
      <GameStage className="my-auto py-8">
        <Notice variant="danger" title={pollError.status === 404 ? 'Partie introuvable' : 'Connexion impossible'}>
          {pollError.status === 404 ? 'Cette partie n’existe plus ou a expiré (les parties sont effacées au bout de 24 h).' : pollError.message}
        </Notice>
        <Link href="/jeux/undercover" className={cn(buttonClasses({ variant: 'inverse', size: 'lg' }), 'mt-4')}>
          Retour aux parties Undercover
        </Link>
      </GameStage>
    );
  }
  if (!game) return <p role="status" className="py-10 text-center text-white/80">Chargement de la partie…</p>;

  const joinUrl = `${origin}/jouer?code=${game.code}`;
  const joined = Object.values(game.players).filter((player) => !player.isHost).length;
  const voters = activePlayers(game).length;
  const speaker = currentSpeaker(game);
  const lastRound = game.roundResults[game.roundResults.length - 1];
  const action = (name: 'start_discussion' | 'next_speaker' | 'start_voting') => run(() => undercoverApi.nextPhase(gameId, name));

  const announcement = (() => {
    switch (game.status) {
      case 'lobby':
        return `${pluralFr(joined, 'joueur')} dans le salon.`;
      case 'role_reveal':
        return 'Les joueurs consultent leur rôle sur leur téléphone.';
      case 'discussion':
        return `Manche ${game.currentRound}. La parole est à ${speaker?.nickname ?? 'un joueur'}.`;
      case 'voting':
        return `${game.voteCount} vote${game.voteCount > 1 ? 's' : ''} sur ${voters}.`;
      case 'vote_result':
        return lastRound?.eliminatedNickname ? `${lastRound.eliminatedNickname} est éliminé.` : 'Égalité : personne n’est éliminé.';
      case 'spy_guess':
        return 'L’Espion tente de deviner le mot des Civils.';
      case 'game_over':
        return 'La partie est terminée.';
    }
  })();

  return (
    <GameStage size="stage" className="py-2">
      <LiveRegion message={announcement} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/jeux/undercover" className="inline-flex min-h-11 items-center gap-1 rounded-md pr-2 text-sm text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-orange-400">
          <ChevronLeft className="size-4" aria-hidden />
          Quitter l’écran d’animation
        </Link>
        <p className="font-display text-xl font-semibold text-white lg:text-2xl">Fourmi Caché</p>
        {game.status !== 'lobby' && game.status !== 'game_over' ? <p className="text-lg text-white/80">Manche {game.currentRound}</p> : <span />}
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-base font-medium text-danger">
          {error}
        </p>
      ) : null}

      {game.status === 'lobby' ? (
        <section aria-labelledby="titre-salon" className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-14">
          <div className="flex flex-col items-center gap-5 text-center">
            <h1 id="titre-salon" className="font-display text-2xl font-semibold text-white lg:text-4xl">
              Rejoignez la partie
            </h1>
            <CodeBadge code={game.code} size="xl" />
            {origin ? <JoinQr url={joinUrl} size={260} label="QR code pour rejoindre la partie" /> : null}
            <p className="text-base text-white/80 lg:text-lg">
              Scannez le QR code, ou rendez-vous sur <strong className="text-white">{origin.replace(/^https?:\/\//, '')}/jouer</strong> et saisissez le code.
            </p>
          </div>
          <div className="flex flex-col gap-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold text-white lg:text-3xl">Joueurs</h2>
              <span className="text-lg text-white/80">
                {joined} / {game.maxPlayers - 1}
              </span>
            </div>
            <LobbyPlayers game={game} scale="stage" />
            {joined < MIN_PLAYERS ? (
              <p className="text-base text-white/80">Il faut au moins {MIN_PLAYERS} joueurs pour démarrer (animateur non compris).</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button size="lg" loading={busy} disabled={joined < MIN_PLAYERS} onClick={() => run(() => undercoverApi.start(gameId))}>
                <Play aria-hidden />
                Lancer la partie ({pluralFr(joined, 'joueur')})
              </Button>
              <Button size="lg" variant="inverse" disabled={busy} onClick={() => setConfirmCancel(true)}>
                <Ban aria-hidden />
                Annuler la partie
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {game.status === 'role_reveal' ? (
        <section aria-labelledby="titre-role" className="mx-auto flex max-w-3xl flex-col items-center gap-6 py-6 text-center">
          <ShieldCheck className="size-20 text-orange-300" aria-hidden />
          <h1 id="titre-role" className="font-display text-3xl font-semibold text-white lg:text-5xl">
            Chacun consulte son rôle sur son téléphone
          </h1>
          <p className="max-w-2xl text-lg text-white/85 lg:text-2xl">
            Les rôles et les mots ne s’affichent jamais sur cet écran. Demandez aux joueurs de cacher leur téléphone, puis de ne rien dire.
          </p>
          <Button size="lg" loading={busy} onClick={() => action('start_discussion')}>
            Tout le monde a vu son rôle
            <ArrowRight aria-hidden />
          </Button>
        </section>
      ) : null}

      {game.status === 'discussion' ? (
        <section aria-labelledby="titre-parole" className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
          <div className="flex flex-col items-center justify-center gap-5 text-center">
            <h1 id="titre-parole" className="text-xl font-medium text-white/80 lg:text-2xl">
              Tour de parole
            </h1>
            <p className="text-lg text-white/70">À qui le tour</p>
            <p className="font-display text-5xl font-semibold break-words text-white lg:text-8xl">{speaker?.nickname ?? '—'}</p>
            <p className="max-w-xl text-lg text-white/80 lg:text-2xl">Décrire son mot en une phrase, sans le prononcer.</p>
            {isLastSpeaker(game) ? (
              <Button size="lg" loading={busy} onClick={() => action('start_voting')}>
                <Vote aria-hidden />
                Passer au vote
              </Button>
            ) : (
              <Button size="lg" loading={busy} onClick={() => action('next_speaker')}>
                Joueur suivant
                <ArrowRight aria-hidden />
              </Button>
            )}
            {!isLastSpeaker(game) ? (
              <Button size="md" variant="inverse" disabled={busy} onClick={() => action('start_voting')}>
                Passer directement au vote
              </Button>
            ) : null}
          </div>
          <SpeakingOrder game={game} scale="stage" />
        </section>
      ) : null}

      {game.status === 'voting' ? (
        <section aria-labelledby="titre-vote" className="mx-auto flex max-w-3xl flex-col items-center gap-6 py-6 text-center">
          <h1 id="titre-vote" className="font-display text-4xl font-semibold text-white lg:text-6xl">
            {game.tiebreakPlayerIds ? 'Égalité : nouveau vote' : 'Vote en cours'}
          </h1>
          <p className="text-lg text-white/85 lg:text-2xl">
            {game.tiebreakPlayerIds
              ? `Les joueurs revotent entre : ${game.tiebreakPlayerIds.map((id) => game.players[id]?.nickname ?? '?').join(', ')}.`
              : 'Chaque joueur vote sur son téléphone.'}
          </p>
          <div className="w-full max-w-xl">
            <VoteProgress received={game.voteCount} total={voters} scale="stage" />
          </div>
          <p className="text-base text-white/75">
            {voters - game.voteCount > 0 ? `${pluralFr(voters - game.voteCount, 'joueur')} n’${voters - game.voteCount > 1 ? 'ont' : 'a'} pas encore voté.` : 'Tous les votes sont arrivés.'}
          </p>
          <Button size="lg" loading={busy} onClick={() => run(() => undercoverApi.resolveVote(gameId))}>
            Révéler le résultat
            <ArrowRight aria-hidden />
          </Button>
        </section>
      ) : null}

      {game.status === 'vote_result' && lastRound ? (
        <section aria-labelledby="titre-resultat" className="mx-auto flex max-w-3xl flex-col gap-6 py-4">
          <h1 id="titre-resultat" className="sr-only">
            Résultat du vote
          </h1>
          <EliminationResult game={game} round={lastRound} scale="stage" />
          <div className="flex justify-center">
            <Button size="lg" loading={busy} onClick={() => action('start_discussion')}>
              Manche suivante
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </section>
      ) : null}

      {game.status === 'spy_guess' ? (
        <section aria-labelledby="titre-espion" className="mx-auto flex max-w-3xl flex-col items-center gap-5 py-10 text-center">
          <h1 id="titre-espion" className="font-display text-4xl font-semibold text-white lg:text-6xl">
            Dernière chance
          </h1>
          <p className="text-lg text-white/85 lg:text-2xl">L’Espion a été éliminé : il tente de deviner le mot des Civils sur son téléphone.</p>
          <GamePanel className="px-8 py-4 text-lg text-white/80">En attente de sa réponse…</GamePanel>
        </section>
      ) : null}

      {game.status === 'game_over' ? (
        <section aria-labelledby="titre-fin" className="mx-auto flex max-w-5xl flex-col gap-6 py-4">
          <h1 id="titre-fin" className="sr-only">
            Fin de la partie
          </h1>
          <GameOverSummary game={game} scale="stage" />
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" loading={busy} onClick={() => run(() => undercoverApi.replay(gameId))}>
              <RotateCcw aria-hidden />
              Rejouer avec les mêmes joueurs
            </Button>
            <Link href="/jeux/undercover" className={buttonClasses({ variant: 'inverse', size: 'lg' })}>
              Terminer
            </Link>
          </div>
        </section>
      ) : null}

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent title="Annuler la partie ?" description="Les joueurs déjà connectés seront renvoyés et le code ne fonctionnera plus." size="sm">
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose className={buttonClasses({ variant: 'outline', size: 'lg' })}>Continuer la partie</DialogClose>
            <Button variant="danger" size="lg" loading={busy} onClick={cancel}>
              Annuler la partie
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </GameStage>
  );
}
