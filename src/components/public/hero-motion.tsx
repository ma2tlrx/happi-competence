'use client';

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import Image from 'next/image';
import { Fragment, useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Titre dévoilé ligne par ligne au chargement (masque + glissement, en CSS : visible sans JavaScript). */
export function SplitHeadline({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <h1 className={className}>
      {lines.map((line, index) => (
        <Fragment key={line}>
          {index > 0 ? ' ' : null}
          <span className="block overflow-hidden pb-[0.08em]">
            <span className="hero-line block" style={{ animationDelay: `${0.1 + index * 0.09}s` }}>
              {line}
            </span>
          </span>
        </Fragment>
      ))}
    </h1>
  );
}

/** Apparition au chargement, synchronisée avec le titre. */
export function Intro({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <div className={cn('hero-intro', className)} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

/** Élément attiré par le curseur (souris uniquement). */
export function Magnetic({ children, strength = 0.28 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 220, damping: 16, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 16, mass: 0.4 });

  return (
    <motion.span
      ref={ref}
      className="inline-flex"
      style={{ x, y }}
      onPointerMove={(event) => {
        if (reduce || event.pointerType !== 'mouse' || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        x.set((event.clientX - rect.left - rect.width / 2) * strength);
        y.set((event.clientY - rect.top - rect.height / 2) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

/** Mascotte en relief : suit légèrement le pointeur et flotte. */
export function HeroMascot() {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-1, 1], [-14, 14]), {
    stiffness: 90,
    damping: 18,
  });
  const rotateX = useSpring(useTransform(py, [-1, 1], [10, -10]), {
    stiffness: 90,
    damping: 18,
  });
  const shiftX = useSpring(useTransform(px, [-1, 1], [-14, 14]), {
    stiffness: 90,
    damping: 18,
  });

  useEffect(() => {
    if (reduce) return;
    const onMove = (event: PointerEvent) => {
      px.set((event.clientX / window.innerWidth) * 2 - 1);
      py.set((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [px, py, reduce]);

  return (
    <motion.div
      className="pointer-events-none absolute right-[4%] bottom-0 z-[5] hidden w-[clamp(11rem,17vw,16rem)] lg:block"
      style={{ perspective: 800 }}
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.5, ease: EASE }}
      aria-hidden
    >
      <motion.div
        style={{ rotateX, rotateY, x: shiftX }}
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Image
          src="/brand/happi-mascotte-3d.webp"
          alt=""
          width={598}
          height={1000}
          priority
          className="h-auto w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)]"
        />
      </motion.div>
    </motion.div>
  );
}
