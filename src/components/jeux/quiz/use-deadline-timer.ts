'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minuteur calé sur une échéance (et non sur un décompte par pas) : reste juste si l'onglet
 * ralentit. `onExpire` n'est appelé qu'une fois par démarrage.
 */
export function useDeadlineTimer() {
  const [timeLeft, setTimeLeft] = useState(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (interval.current) clearInterval(interval.current);
    interval.current = null;
  }, []);

  const start = useCallback(
    (seconds: number, onExpire?: () => void) => {
      stop();
      const deadline = Date.now() + Math.max(0, seconds) * 1000;
      const tick = () => {
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setTimeLeft(left);
        if (left <= 0) {
          stop();
          onExpire?.();
        }
      };
      tick();
      if (interval.current === null && deadline > Date.now()) interval.current = setInterval(tick, 250);
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { timeLeft, start, stop };
}
