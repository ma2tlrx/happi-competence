import { Check } from 'lucide-react';

import { parisDate } from '@/lib/attendance/signature';
import { compactTimeRange } from '@/lib/organisme/groups';
import type { SessionView } from '@/lib/organisme/load';
import { cn, formatShortDate } from '@/lib/utils';

type TileState = 'completed' | 'in_progress' | 'upcoming' | 'planned' | 'cancelled' | 'unplanned';

const STATE_TEXT: Record<TileState, string> = {
  completed: 'Faite',
  in_progress: 'En cours',
  upcoming: 'À venir',
  planned: 'Prévue',
  cancelled: 'Annulée',
  unplanned: 'À planifier',
};

const TILE_STYLE: Record<TileState, string> = {
  completed: 'bg-orange-500 text-petrol-950',
  in_progress: 'bg-white text-petrol-900',
  upcoming: 'bg-petrol-700 text-white',
  planned: 'bg-petrol-700 text-white',
  cancelled: 'bg-petrol-800 text-white/40 line-through',
  unplanned: 'border border-dashed border-white/40 text-white/60',
};

function tileState(session: SessionView | null, today: string): TileState {
  if (!session) return 'unplanned';
  if (session.status === 'completed' || session.status === 'in_progress' || session.status === 'cancelled') return session.status;
  // Séance prévue dont la date est passée mais pas encore close par le formateur : « prévue », pas « à venir ».
  return session.date && session.date < today ? 'planned' : 'upcoming';
}

/**
 * Les séances du groupe, une case par séance du programme (comme la carte du parcours du participant) :
 * date, horaire et état. Une séance pas encore planifiée garde sa place.
 */
export function SessionStrip({ sessions, total }: { sessions: SessionView[]; total: number }) {
  const today = parisDate();
  const count = Math.max(total, ...sessions.map((session) => session.number), 0);
  const byNumber = new Map(sessions.map((session) => [session.number, session]));
  return (
    <ol aria-label="Les séances du groupe" className="grid grid-cols-3 gap-2 sm:gap-3 xl:grid-cols-6">
      {Array.from({ length: count }, (_, index) => {
        const number = index + 1;
        const session = byNumber.get(number) ?? null;
        const state = tileState(session, today);
        return (
          <li key={number} className="flex min-w-0 flex-col gap-2 rounded-lg bg-white/[0.06] p-2.5 ring-1 ring-white/10 sm:p-3">
            <span aria-hidden className={cn('pixel-corners flex size-9 items-center justify-center font-display text-sm font-semibold', TILE_STYLE[state])}>
              {state === 'completed' ? <Check className="size-[1.125rem]" strokeWidth={3} /> : number}
            </span>
            <span className="text-[0.8125rem] leading-snug sm:text-sm">
              <span className="block font-semibold text-white">Séance {number}</span>
              <span className="block text-white/75">{session?.date ? formatShortDate(session.date) : 'Date à fixer'}</span>
              {session?.startTime ? <span className="block whitespace-nowrap text-white/65 tabular-nums">{compactTimeRange(session.startTime, session.endTime)}</span> : null}
              <span className={cn('mt-1 block text-xs font-semibold', state === 'completed' ? 'text-orange-300' : state === 'in_progress' ? 'text-white' : 'text-white/65')}>
                {STATE_TEXT[state]}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
