'use client';

import { Trophy } from 'lucide-react';
import { motion } from 'motion/react';

import type { LeaderboardEntry } from '@/lib/jeux/client-quiz';
import { cn } from '@/lib/utils';

const podium = ['bg-orange-500 text-petrol-950', 'bg-petrol-200 text-petrol-950', 'bg-orange-200 text-petrol-950'];

/** Classement sur fond pétrole. Le rang est écrit en chiffres : aucune information portée par la seule couleur. */
export function Leaderboard({
  entries,
  limit,
  highlightId,
  large = false,
  className,
}: {
  entries: LeaderboardEntry[];
  limit?: number;
  highlightId?: string;
  /** Lisibilité projecteur. */
  large?: boolean;
  className?: string;
}) {
  const shown = limit ? entries.slice(0, limit) : entries;
  return (
    <ol className={cn('space-y-2', large && 'space-y-3', className)}>
      {shown.map((p, i) => {
        const me = p.id === highlightId;
        return (
          <motion.li
            key={p.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.05 }}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2.5',
              large && 'gap-4 px-5 py-3.5',
              me ? 'border-orange-400 bg-orange-500/20' : 'border-white/15 bg-white/10',
            )}
            aria-label={`${p.rank}. ${p.nickname}${me ? ' (vous)' : ''}, ${p.score} points`}
          >
            <span
              aria-hidden
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold',
                large && 'size-11 text-xl',
                podium[i] ?? 'bg-white/15 text-white',
              )}
            >
              {i === 0 ? <Trophy className={cn('size-4', large && 'size-6')} /> : p.rank}
            </span>
            <span aria-hidden className={cn('min-w-0 flex-1 truncate font-semibold text-white', large ? 'text-2xl' : 'text-[0.9375rem]')}>
              {p.nickname}
              {me ? ' (vous)' : ''}
            </span>
            <span aria-hidden className={cn('font-display font-bold text-orange-300 tabular-nums', large ? 'text-3xl' : 'text-base')}>
              {p.score}
              <span className={cn('ml-1 font-sans font-normal text-white/70', large ? 'text-lg' : 'text-xs')}>pts</span>
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}
