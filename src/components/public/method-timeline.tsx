'use client';

import { motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react';
import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { useHydrated, usePrefersReducedMotion } from './use-motion-preference';

/**
 * La méthode en étapes : un fil se trace au défilement et chaque étape s'allume
 * lorsqu'il l'atteint. Sans JavaScript ou sans animation, toutes les étapes sont allumées.
 */
export function MethodTimeline({ steps }: { steps: { title: string; text: string }[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = usePrefersReducedMotion();
  const hydrated = useHydrated();
  const [reached, setReached] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.72', 'end 0.6'] });
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    setReached((previous) => Math.max(previous, Math.min(steps.length, Math.floor(value * steps.length + 0.35))));
  });

  return (
    <ol ref={ref} className="relative">
      <span className="absolute top-5 bottom-5 left-[1.1875rem] w-px bg-line-strong" aria-hidden />
      <motion.span
        className="absolute top-5 bottom-5 left-[1.1875rem] w-px origin-top bg-orange-500"
        style={reduce ? undefined : { scaleY: line }}
        aria-hidden
      />
      {steps.map((step, index) => {
        const on = !hydrated || reduce || index < reached;
        return (
          <li key={step.title} className="relative flex gap-5 pb-8 last:pb-0">
            <span
              className={cn(
                'relative z-10 flex size-10 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-medium transition-colors duration-500',
                on ? 'border-petrol-900 bg-petrol-900 text-white' : 'border-line-strong bg-paper text-ink-subtle',
              )}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="pt-1.5">
              <h3 className="font-display text-lg font-semibold">{step.title}</h3>
              <p className="mt-1 text-ink-muted">{step.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
