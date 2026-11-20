import { Skull } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Pastille ronde avec l'initiale du pseudo (ou une tête de mort pour un joueur éliminé). */
export function PlayerAvatar({ nickname, eliminated = false, size = 'md' }: { nickname: string; eliminated?: boolean; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-display font-semibold',
        size === 'lg' ? 'size-12 text-lg' : 'size-9 text-sm',
        eliminated ? 'bg-white/10 text-white/60' : 'bg-orange-500 text-petrol-950',
      )}
    >
      {eliminated ? <Skull className={size === 'lg' ? 'size-6' : 'size-5'} /> : (nickname.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/**
 * Pastille de joueur. Sans `onSelect`, c'est un simple élément d'affichage ; avec, c'est un bouton
 * (cible tactile d'au moins 44 px) pour voter, par exemple.
 */
export function PlayerChip({
  nickname,
  eliminated = false,
  selected = false,
  disabled = false,
  onSelect,
  hint,
  className,
}: {
  nickname: string;
  eliminated?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  hint?: ReactNode;
  className?: string;
}) {
  const classes = cn(
    'flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left',
    selected ? 'border-orange-400 bg-orange-500/20' : 'border-white/15 bg-white/[0.06]',
    eliminated && 'opacity-60',
    className,
  );
  const content = (
    <>
      <PlayerAvatar nickname={nickname} eliminated={eliminated} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-white">{nickname}</span>
        {hint ? <span className="block text-sm text-white/70">{hint}</span> : null}
        {eliminated ? <span className="sr-only"> (éliminé)</span> : null}
      </span>
    </>
  );
  if (!onSelect) return <div className={classes}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(classes, 'transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:opacity-50')}
    >
      {content}
    </button>
  );
}
