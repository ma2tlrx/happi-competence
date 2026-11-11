'use client';

import { animate, useInView } from 'motion/react';
import { useEffect, useRef } from 'react';

import { usePrefersReducedMotion } from './use-motion-preference';

/**
 * Compteur : la valeur réelle est dans le HTML (lecteurs d'écran, absence de JavaScript) ;
 * le décompte n'est qu'un habillage joué une fois, à l'arrivée dans l'écran.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = usePrefersReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.6 });

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView || reduce) return;
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        node.textContent = String(Math.round(latest));
      },
    });
    return () => {
      controls.stop();
      node.textContent = String(value);
    };
  }, [inView, reduce, value]);

  return (
    <>
      <span ref={ref} className={className} aria-hidden>
        {value}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
