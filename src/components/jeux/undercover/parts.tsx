import { Bug, Check, Eye, Scale, Skull, Trophy, Users, type LucideIcon } from 'lucide-react';

import { GamePanel } from '@/components/jeux/shared/game-shell';
import { PlayerAvatar } from '@/components/jeux/shared/player-chip';
import type { PublicGame, RoundResult, UndercoverRole, UndercoverWinner } from '@/lib/jeux/client-undercover';
import { activeSpeakingOrder, pluralFr, tallyVotes } from '@/lib/jeux/undercover-view';
import { cn } from '@/lib/utils';

/** Les trois rôles. La couleur ne porte jamais seule l'information : chaque rôle a son icône et son nom. */
export const ROLE_META: Record<UndercoverRole, { label: string; icon: LucideIcon; hint: string; accent: string }> = {
  civil: { label: 'Civil', icon: Users, hint: 'Trouvez la Fourmi parmi vous.', accent: 'text-petrol-200' },
  undercover: { label: 'Fourmi', icon: Bug, hint: 'Restez discret et survivez !', accent: 'text-orange-300' },
  spy: { label: 'Espion (Mister White)', icon: Eye, hint: 'Vous n’avez pas de mot : observez, puis devinez celui des Civils.', accent: 'text-white' },
};

export const WINNER_META: Record<UndercoverWinner, { label: string; icon: LucideIcon }> = {
  civils: { label: 'Les Civils gagnent !', icon: Trophy },
  undercover: { label: 'La Fourmi gagne !', icon: Bug },
  spy: { label: 'L’Espion gagne !', icon: Eye },
};

type View = 'player' | 'stage';

const text = {
  player: { title: 'text-2xl', body: 'text-base', small: 'text-sm', name: 'text-lg' },
  stage: { title: 'text-4xl lg:text-5xl', body: 'text-xl lg:text-2xl', small: 'text-lg', name: 'text-2xl lg:text-3xl' },
} as const;

export function RoleBadge({ role, className }: { role: UndercoverRole; className?: string }) {
  const meta = ROLE_META[role];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-semibold', meta.accent, className)}>
      <meta.icon className="size-4" aria-hidden />
      {meta.label}
    </span>
  );
}

/** Joueurs du salon d'attente. */
export function LobbyPlayers({ game, selfId, scale = 'player' }: { game: PublicGame; selfId?: string; scale?: View }) {
  const players = Object.values(game.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const t = text[scale];
  return (
    <ul className={cn('grid gap-2', scale === 'stage' && 'sm:grid-cols-2 xl:grid-cols-3')}>
      {players.map((player) => (
        <li key={player.id} className="flex min-h-14 items-center gap-3 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2">
          <PlayerAvatar nickname={player.nickname} size={scale === 'stage' ? 'lg' : 'md'} />
          <span className={cn('min-w-0 flex-1 truncate font-medium text-white', t.name)}>{player.nickname}</span>
          {player.isHost ? <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">Animateur</span> : null}
          {player.id === selfId && !player.isHost ? <span className="text-sm text-white/70">Vous</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Ordre de parole de la manche : qui a parlé, qui parle, qui reste. */
export function SpeakingOrder({ game, selfId, scale = 'player' }: { game: PublicGame; selfId?: string; scale?: View }) {
  const order = activeSpeakingOrder(game);
  const t = text[scale];
  return (
    <ol className="grid gap-2" aria-label="Ordre de parole">
      {order.map((id, index) => {
        const player = game.players[id];
        const done = index < game.currentSpeakerIndex;
        const current = index === game.currentSpeakerIndex;
        return (
          <li
            key={id}
            aria-current={current ? 'step' : undefined}
            className={cn(
              'flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2',
              current ? 'border-orange-400 bg-orange-500/20' : 'border-white/10 bg-white/[0.04]',
              done && 'opacity-60',
            )}
          >
            <span className={cn('w-7 text-center font-mono text-white/70', t.small)}>{index + 1}</span>
            <span className={cn('min-w-0 flex-1 truncate text-white', t.body, current && 'font-semibold')}>
              {player?.nickname}
              {id === selfId ? ' (vous)' : ''}
            </span>
            {done ? (
              <span className="flex items-center gap-1 text-sm text-white/80">
                <Check className="size-4" aria-hidden />
                A parlé
              </span>
            ) : null}
            {current ? <span className="text-sm font-semibold text-orange-200">Prend la parole</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Avancement du vote (barre de progression lisible par un lecteur d'écran). */
export function VoteProgress({ received, total, scale = 'player' }: { received: number; total: number; scale?: View }) {
  const share = total > 0 ? Math.min(100, (received / total) * 100) : 0;
  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-label="Votes reçus"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={received}
        aria-valuetext={`${received} vote${received > 1 ? 's' : ''} sur ${total}`}
        className="h-2.5 overflow-hidden rounded-full bg-white/15"
      >
        <div className="h-full rounded-full bg-orange-400" style={{ width: `${share}%`, transition: 'width 0.3s ease-out' }} />
      </div>
      <p className={cn('mt-2 text-center text-white/80', text[scale].small)}>
        {received} / {total} votes
      </p>
    </div>
  );
}

/** Résultat d'un vote : joueur éliminé (et son rôle) ou égalité, puis décompte des voix. */
export function EliminationResult({ game, round, scale = 'player' }: { game: PublicGame; round: RoundResult; scale?: View }) {
  const t = text[scale];
  const tally = tallyVotes(game, round);
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        {round.eliminatedId ? (
          <>
            <Skull className={cn('mx-auto text-orange-300', scale === 'stage' ? 'size-20' : 'size-12')} aria-hidden />
            <p className={cn('mt-2 text-white/80', t.body)}>Éliminé</p>
            <p className={cn('font-display font-semibold text-white', t.title)}>{round.eliminatedNickname}</p>
            {round.eliminatedRole ? (
              <p className={cn('mt-3', t.body)}>
                <span className="sr-only">Son rôle : </span>
                <RoleBadge role={round.eliminatedRole} className={scale === 'stage' ? 'text-xl' : undefined} />
              </p>
            ) : null}
          </>
        ) : (
          <>
            <Scale className={cn('mx-auto text-orange-300', scale === 'stage' ? 'size-20' : 'size-12')} aria-hidden />
            <p className={cn('mt-2 font-display font-semibold text-white', t.title)}>Égalité parfaite</p>
            <p className={cn('text-white/80', t.body)}>Personne n’est éliminé ce tour.</p>
          </>
        )}
      </div>
      {tally.length > 0 ? (
        <GamePanel className="p-4">
          <h3 className={cn('mb-2 font-semibold text-white/80', t.small)}>Résultat des votes</h3>
          <ul className="divide-y divide-white/10">
            {tally.map((line) => (
              <li key={line.targetId} className={cn('flex items-center justify-between gap-3 py-2 text-white', t.body)}>
                <span className="min-w-0 truncate">{line.nickname}</span>
                <span className="shrink-0 text-white/80">{pluralFr(line.count, 'vote')}</span>
              </li>
            ))}
          </ul>
        </GamePanel>
      ) : null}
    </div>
  );
}

/** Fin de partie : vainqueur, mots, devinette de l'Espion et rôles (si le serveur les révèle). */
export function GameOverSummary({ game, scale = 'player' }: { game: PublicGame; scale?: View }) {
  const t = text[scale];
  const winner = game.winner ? WINNER_META[game.winner] : null;
  const players = Object.values(game.players)
    .filter((player) => !player.isHost)
    .sort((a, b) => a.joinedAt - b.joinedAt);
  return (
    <div className="flex flex-col gap-5">
      {winner ? (
        <div className="text-center">
          <winner.icon className={cn('mx-auto text-orange-300', scale === 'stage' ? 'size-24' : 'size-14')} aria-hidden />
          <h2 className={cn('mt-2 font-display font-semibold text-white', t.title)}>{winner.label}</h2>
          {game.spyGuess !== undefined ? (
            <p className={cn('mt-2 text-white/85', t.body)}>
              L’Espion a deviné « <strong className="text-white">{game.spyGuess}</strong> » : {game.spyGuessCorrect ? 'correct.' : 'incorrect.'}
            </p>
          ) : null}
        </div>
      ) : null}
      {game.wordPair ? (
        <GamePanel className="flex items-center justify-center gap-6 text-center">
          <div>
            <p className={cn('text-white/70', t.small)}>Mot des Civils</p>
            <p className={cn('font-display font-semibold text-white', t.title)}>{game.wordPair.civil}</p>
          </div>
          <span className="text-white/60" aria-hidden>
            contre
          </span>
          <div>
            <p className={cn('text-white/70', t.small)}>Mot de la Fourmi</p>
            <p className={cn('font-display font-semibold text-white', t.title)}>{game.wordPair.undercover}</p>
          </div>
        </GamePanel>
      ) : null}
      <section>
        <h3 className={cn('mb-2 font-semibold text-white/80', t.small)}>Joueurs</h3>
        <ul className={cn('grid gap-2', scale === 'stage' && 'sm:grid-cols-2 xl:grid-cols-3')}>
          {players.map((player) => (
            <li key={player.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2">
              <PlayerAvatar nickname={player.nickname} eliminated={player.isEliminated} />
              <span className={cn('min-w-0 flex-1 truncate text-white', t.body)}>{player.nickname}</span>
              {game.winnerIds?.includes(player.id) ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-orange-200">
                  <Trophy className="size-4" aria-hidden />
                  Gagnant
                </span>
              ) : null}
              {player.role ? <RoleBadge role={player.role} /> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
