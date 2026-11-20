'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * Minuteur à rebours. Pour le relancer, changer sa `key`. Il ne s'annonce pas à chaque seconde
 * (trop bavard pour un lecteur d'écran) : `label` décrit sa fonction, la valeur est lisible à la demande.
 */
export function Countdown({
  seconds,
  running = true,
  onDone,
  label = 'Temps restant',
  size = 'md',
  className,
}: {
  seconds: number;
  running?: boolean;
  onDone?: () => void;
  label?: string;
  size?: 'md' | 'xl';
  className?: string;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!running) return;
    const end = Date.now() + seconds * 1000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(timer);
        done.current?.();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [running, seconds]);

  const share = seconds > 0 ? Math.min(100, Math.max(0, (remaining / seconds) * 100)) : 0;
  return (
    <div role="timer" aria-label={label} className={cn('w-full', className)}>
      <p className={cn('text-center font-mono font-medium tabular-nums text-white', size === 'xl' ? 'text-7xl' : 'text-3xl')}>
        {remaining}
        <span className="sr-only"> secondes</span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden>
        <div className={cn('h-full rounded-full', remaining <= 5 ? 'bg-orange-400' : 'bg-petrol-300')} style={{ width: `${share}%`, transition: 'width 0.25s linear' }} />
      </div>
    </div>
  );
}
