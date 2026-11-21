'use client';

import { Check, Flag } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';

import type { JourneyStation } from '@/lib/engagement/journey';
import { cn } from '@/lib/utils';

const STATE_TEXT: Record<JourneyStation['state'], string> = {
  attended: 'suivie',
  passed: 'passée',
  current: 'prochaine étape',
  upcoming: 'à venir',
  cancelled: 'annulée',
};

/**
 * Carte du parcours : une case par session, reliées par un chemin. La mascotte HAPPI se pose sur
 * l'étape en cours ; au chargement, elle avance depuis le départ (une seule animation, désactivée
 * si la personne a demandé moins de mouvement).
 */
export function JourneyMap({ stations, currentNumber, finished }: { stations: JourneyStation[]; currentNumber: number | null; finished: boolean }) {
  const count = stations.length;
  const lastReached = [...stations].reverse().find((station) => station.state === 'attended' || station.state === 'passed');
  const markerIndex = currentNumber !== null ? currentNumber - 1 : finished ? count - 1 : lastReached ? lastReached.number - 1 : 0;
  const progressIndex = finished ? count - 1 : Math.max(0, currentNumber !== null ? currentNumber - 1 : (lastReached?.number ?? 1) - 1);
  const ratio = (index: number) => (count > 1 ? index / (count - 1) : 0);
  const showMarker = currentNumber !== null || finished;

  return (
    <div className="relative pt-12">
      {/* Chemin : de la première à la dernière case, derrière les cases. */}
      <div className="absolute top-12 h-10 sm:h-11" style={{ left: `calc(100% / ${count * 2})`, right: `calc(100% / ${count * 2})` }} aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.28)_0_6px,transparent_6px_12px)]" />
        <motion.div
          className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-orange-400"
          initial={{ width: 0 }}
          animate={{ width: `${ratio(progressIndex) * 100}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        {showMarker ? (
          <motion.div
            className="absolute -top-11 z-10 -translate-x-1/2 sm:-top-12"
            initial={{ left: '0%' }}
            animate={{ left: `${ratio(markerIndex) * 100}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.45, repeat: 2, delay: 0.9, ease: 'easeOut' }}>
              <Image src="/brand/happi-mascotte.png" alt="" width={44} height={44} className="size-10 drop-shadow-[0_4px_6px_rgb(0_0_0/0.35)] sm:size-11" priority />
            </motion.div>
          </motion.div>
        ) : null}
      </div>

      <ol aria-label="Mon parcours, session par session" className="relative grid" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {stations.map((station) => (
          <li key={station.number} className="flex min-w-0 flex-col items-center text-center">
            <span
              aria-hidden
              className={cn(
                'pixel-corners flex size-10 items-center justify-center font-display text-sm font-semibold sm:size-11',
                station.state === 'attended' && 'bg-orange-500 text-petrol-950',
                station.state === 'passed' && 'bg-petrol-700 text-white/70',
                station.state === 'current' && 'bg-white text-petrol-900',
                station.state === 'upcoming' && 'bg-petrol-800 text-white/70',
                station.state === 'cancelled' && 'bg-petrol-800/60 text-white/35 line-through',
              )}
            >
              {station.state === 'attended' ? (
                <Check className="size-5" strokeWidth={3} />
              ) : station.isLast && station.state !== 'passed' ? (
                <Flag className="size-[1.125rem]" />
              ) : (
                station.number
              )}
            </span>
            <span className="sr-only">
              Session {station.number}
              {station.title ? `, ${station.title}` : ''} : {STATE_TEXT[station.state]}
            </span>
            <span aria-hidden className={cn('mt-2 hidden px-1 text-xs leading-snug md:block', station.state === 'current' ? 'font-semibold text-white' : 'text-white/60')}>
              <span className="block tabular-nums">Session {station.number}</span>
              {station.title ? <span className="mt-0.5 line-clamp-2 block">{station.title}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
