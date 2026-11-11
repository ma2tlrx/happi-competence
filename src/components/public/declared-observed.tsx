'use client';

import { ChevronsLeftRight } from 'lucide-react';
import { animate, motion, useInView, useMotionTemplate, useMotionValue, useMotionValueEvent } from 'motion/react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { LevelMeter } from '@/components/ui/level-meter';

import { usePrefersReducedMotion } from './use-motion-preference';

export type ComparedSkill = {
  /** Formulation telle qu'on la lit sur un CV. */
  declared: string;
  /** Nom de la compétence dans le référentiel publié. */
  name: string;
  /** Niveau d'illustration (exemple fictif). */
  value: number;
  max: number;
  level: string | null;
  /** Session où la compétence est mobilisée, d'après le référentiel publié. */
  session: number | null;
};

const ROW = 'h-[7rem] sm:h-[4.75rem]';
const HEAD = 'min-h-[6.5rem] sm:min-h-[4.75rem]';
const MIN = 4;
const MAX = 96;

/**
 * « Du déclaré à l'observé » : la même rubrique « Compétences », telle qu'un CV la déclare
 * et telle que le passeport la documente. Le curseur se déplace à la souris, au doigt
 * (poignée) et au clavier (flèches, Début, Fin).
 */
export function DeclaredObserved({ skills, comment }: { skills: ComparedSkill[]; comment: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const touched = useRef(false);
  const reduce = usePrefersReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.55 });
  // Part de la largeur occupée par le CV (à gauche), en pourcentage.
  const split = useMotionValue(50);
  const clip = useMotionTemplate`inset(0 0 0 ${split}%)`;
  const left = useMotionTemplate`${split}%`;
  const [value, setValue] = useState(50);

  useMotionValueEvent(split, 'change', (latest) => setValue(Math.round(latest)));

  // À l'arrivée dans l'écran, le curseur fait un aller-retour pour montrer qu'il se déplace.
  useEffect(() => {
    if (!inView || reduce || touched.current) return;
    const controls = animate(split, [50, 82, 22, 50], { duration: 2.8, ease: [0.45, 0, 0.55, 1], delay: 0.2 });
    return () => controls.stop();
  }, [inView, reduce, split]);

  const moveTo = (next: number) => {
    touched.current = true;
    split.stop();
    split.set(Math.min(MAX, Math.max(MIN, next)));
  };
  const moveToPointer = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    moveTo(((clientX - rect.left) / rect.width) * 100);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveToPointer(event.clientX);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (dragging.current) moveToPointer(event.clientX);
  };
  const onPointerEnd = () => {
    dragging.current = false;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -4, ArrowDown: -4, ArrowRight: 4, ArrowUp: 4, PageDown: -20, PageUp: 20 };
    if (event.key === 'Home') moveTo(MIN);
    else if (event.key === 'End') moveTo(MAX);
    else if (event.key in steps) moveTo(split.get() + steps[event.key]!);
    else return;
    event.preventDefault();
  };

  return (
    <div>
      <div
        ref={ref}
        className="relative isolate grid overflow-hidden rounded-2xl border border-line-strong bg-paper select-none"
        // À la souris, on peut saisir le curseur n'importe où ; au doigt, seule la poignée le déplace (le défilement reste libre).
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse') onPointerDown(event);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* Le CV : ce que la personne déclare */}
        <div className="[grid-area:1/1] p-5 sm:p-8">
          <div className={`max-w-[46%] ${HEAD}`}>
            <p className="font-mono text-xs tracking-[0.08em] text-ink-subtle uppercase">Sur un CV</p>
            <h3 className="mt-1 font-display text-base font-semibold sm:text-xl">Ce que l’on déclare</h3>
          </div>
          <ul className="border-t border-line-strong">
            {skills.map((skill) => (
              <li key={skill.name} className={`flex items-center border-b border-line-strong text-[0.9375rem] text-ink sm:text-lg ${ROW}`}>
                <span className="max-w-[46%]">{skill.declared}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-[46%] text-sm text-ink-muted">Pas de niveau, pas de situation, pas de regard extérieur.</p>
        </div>

        {/* Le passeport : ce qui a été observé */}
        <motion.div className="pixel-grid bg-petrol-900 p-5 text-white [grid-area:1/1] sm:p-8" style={{ clipPath: clip }}>
          <div className={`ml-auto max-w-[46%] text-right ${HEAD}`}>
            <p className="font-mono text-xs tracking-[0.08em] text-white/65 uppercase">Dans le passeport</p>
            <h3 className="mt-1 font-display text-base font-semibold text-white sm:text-xl">Ce qui a été observé</h3>
          </div>
          <ul className="border-t border-white/15">
            {skills.map((skill) => (
              <li key={skill.name} className={`grid grid-cols-2 items-center gap-x-6 border-b border-white/15 sm:gap-x-12 ${ROW}`}>
                <span className="text-[0.9375rem] font-semibold sm:text-lg">{skill.name}</span>
                <span className="min-w-0">
                  <LevelMeter
                    value={skill.value}
                    min={1}
                    max={skill.max}
                    tone="inverse"
                    label={`${skill.name} : niveau ${skill.value} sur ${skill.max}${skill.level ? `, ${skill.level}` : ''}`}
                  />
                  <span className="mt-2 flex flex-wrap items-baseline gap-x-2.5 text-sm">
                    <span className="font-mono text-white tabular-nums">
                      {skill.value}/{skill.max}
                    </span>
                    {skill.level ? <span className="text-white/80">{skill.level}</span> : null}
                    {skill.session ? <span className="text-white/65">Session {skill.session}</span> : null}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <figure className="mt-5 ml-auto max-w-[46%] text-sm">
            <blockquote className="text-white/85">« {comment} »</blockquote>
            <figcaption className="mt-1 text-white/65">Commentaire d’un formateur</figcaption>
          </figure>
        </motion.div>

        {/* Curseur */}
        <motion.div
          role="slider"
          tabIndex={0}
          aria-label="Comparer le CV et le passeport de compétences"
          aria-orientation="horizontal"
          aria-valuemin={MIN}
          aria-valuemax={MAX}
          aria-valuenow={value}
          aria-valuetext={`CV visible à ${value} %, passeport à ${100 - value} %`}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => {
            if (event.pointerType !== 'mouse') onPointerDown(event);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          className="group absolute inset-y-0 z-10 flex w-11 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded-none outline-none"
          style={{ left }}
        >
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-orange-500" aria-hidden />
          <span className="relative flex size-11 items-center justify-center rounded-md bg-orange-500 text-petrol-950 shadow-md ring-white/90 transition-transform duration-150 group-hover:scale-105 group-focus-visible:ring-4 group-active:scale-95">
            <ChevronsLeftRight className="size-5" aria-hidden />
          </span>
        </motion.div>
      </div>
      <p className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm text-ink-muted">
        <span>Faites glisser le curseur pour comparer.</span>
        <span>Exemple fictif, construit avec les niveaux du référentiel.</span>
      </p>
    </div>
  );
}
