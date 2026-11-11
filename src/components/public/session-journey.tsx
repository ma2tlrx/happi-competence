'use client';

import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react';
import { useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { usePrefersReducedMotion } from './use-motion-preference';

export type JourneySession = {
  number: number;
  title: string;
  summary: string | null;
  is_provisional?: boolean;
};
export type JourneySkill = {
  name: string;
  kind: 'ct' | 'hbs';
  /** Catégorie (compétences transversales) ou dimension (habiletés) dans le référentiel publié. */
  group: string;
  sessions: number[];
};

const EASE = [0.22, 1, 0.36, 1] as const;

type Block = {
  kind: JourneySkill['kind'];
  title: string;
  short: string;
  groups: { name: string; skills: JourneySkill[] }[];
};

/** Regroupe les compétences par référentiel puis par catégorie, dans l'ordre du référentiel. */
function blocksOf(skills: JourneySkill[]): Block[] {
  const definitions = [
    { kind: 'ct' as const, title: 'Compétences transversales', short: 'Transversales' },
    { kind: 'hbs' as const, title: 'Habiletés socio-cognitives', short: 'Habiletés' },
  ];
  return definitions
    .map((definition) => {
      const groups: Block['groups'] = [];
      for (const skill of skills) {
        if (skill.kind !== definition.kind) continue;
        const group = groups.find((item) => item.name === skill.group);
        if (group) group.skills.push(skill);
        else groups.push({ name: skill.group, skills: [skill] });
      }
      return { ...definition, groups };
    })
    .filter((block) => block.groups.length > 0);
}

/**
 * Les six sessions, racontées au défilement : la section reste à l'écran et le
 * tableau des compétences se remplit session après session, d'après la
 * correspondance sessions / compétences du référentiel publié.
 */
export function SessionJourney({ sessions, skills }: { sessions: JourneySession[]; skills: JourneySkill[] }) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return <StaticJourney sessions={sessions} skills={skills} />;
  return <PinnedJourney sessions={sessions} skills={skills} />;
}

function skillsOf(skills: JourneySkill[], session: number) {
  return {
    ct: skills.filter((skill) => skill.kind === 'ct' && skill.sessions.includes(session)),
    hbs: skills.filter((skill) => skill.kind === 'hbs' && skill.sessions.includes(session)),
  };
}

function PinnedJourney({ sessions, skills }: { sessions: JourneySession[]; skills: JourneySkill[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    mass: 0.4,
  });
  const count = sessions.length;

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    setActive(Math.min(count - 1, Math.max(0, Math.floor(value * count))));
  });

  const blocks = useMemo(() => blocksOf(skills), [skills]);

  const session = sessions[active];
  if (!session) return null;
  const current = session.number;
  const mobilised = skillsOf(skills, current);

  return (
    <div ref={ref} style={{ height: `${count * 70 + 40}svh` }} className="relative">
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col overflow-hidden lg:top-[4.5rem] lg:h-[calc(100svh-4.5rem)]">
        {/* Jauge d'expérience */}
        <div className="container-site pt-6 sm:pt-8">
          <div className="flex items-center gap-4">
            <span className="shrink-0 text-sm text-white/60">Progression</span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-orange-500"
                style={{ scaleX: progress }}
              />
            </div>
            <span className="shrink-0 font-display text-sm font-semibold text-white tabular-nums">
              {current}/{count}
            </span>
          </div>
        </div>

        <div className="container-site grid min-h-0 flex-1 content-center items-center gap-8 py-6 lg:grid-cols-[0.8fr_1.2fr]">
          {/* Récit de la session */}
          <div className="order-2 min-h-0 lg:order-1">
            <div className="flex items-end gap-4">
              <span className="relative block h-[clamp(4.5rem,11vw,9.5rem)] overflow-hidden font-display text-[clamp(4.5rem,11vw,9.5rem)] leading-none font-semibold tracking-[-0.06em] text-orange-500 tabular-nums">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={current}
                    className="block"
                    initial={{ y: '100%' }}
                    animate={{
                      y: '0%',
                      transition: { duration: 0.4, ease: EASE },
                    }}
                    exit={{
                      y: '-100%',
                      transition: { duration: 0.2, ease: 'easeIn' },
                    }}
                  >
                    {current}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="mb-2 text-white/50 sm:mb-4">sur {count}</span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <h3 className="mt-3 text-display-md text-white">{session.title}</h3>
                {session.summary ? <p className="mt-3 max-w-lg text-white/70 max-lg:line-clamp-3">{session.summary}</p> : null}
                {session.is_provisional ? (
                  <p className="mt-3 max-w-lg text-white/70">Le contenu de cette session sera publié avec le programme définitif.</p>
                ) : null}
                {mobilised.ct.length + mobilised.hbs.length > 0 ? (
                  <ul className="mt-5 flex max-w-xl flex-wrap gap-1.5" aria-label={`Compétences mobilisées en session ${current}`}>
                    {mobilised.ct.map((skill, index) => (
                      <motion.li
                        key={skill.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 + index * 0.04 }}
                        className="rounded-md bg-orange-500 px-2.5 py-1 text-sm font-semibold text-petrol-950"
                      >
                        {skill.name}
                      </motion.li>
                    ))}
                    {mobilised.hbs.map((skill, index) => (
                      <motion.li
                        key={skill.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + index * 0.03 }}
                        className="rounded-md border border-orange-300/40 px-2.5 py-1 text-sm text-orange-200 max-sm:sr-only"
                      >
                        {skill.name}
                      </motion.li>
                    ))}
                  </ul>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Tableau des compétences : complet sur grand écran, condensé sinon */}
          <div className="order-1 min-w-0 lg:order-2" aria-hidden>
            <StampBoard blocks={blocks} current={current} className="hidden board:block" />
            <MiniBoard blocks={blocks} current={current} className="mx-auto max-w-md board:hidden" />
          </div>
        </div>

        <div className="container-site flex flex-wrap gap-x-6 gap-y-2 pb-6 text-sm text-white/60 max-sm:hidden [@media(max-height:46rem)]:hidden">
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-[2px] bg-orange-500" aria-hidden /> Mobilisée dans cette session
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-[2px] bg-petrol-500" aria-hidden /> Déjà travaillée
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-[2px] border border-white/25" aria-hidden /> À venir
          </span>
        </div>
      </div>
    </div>
  );
}

function reachedCount(block: Block, current: number) {
  return block.groups.reduce((total, group) => total + group.skills.filter((skill) => skill.sessions.some((n) => n <= current)).length, 0);
}
function totalCount(block: Block) {
  return block.groups.reduce((total, group) => total + group.skills.length, 0);
}

function BlockHeader({ block, current, short = false }: { block: Block; current: number; short?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-2">
      <span className="font-mono text-xs tracking-[0.08em] text-white/65 uppercase">{short ? block.short : block.title}</span>
      <span className="font-mono text-xs text-white/65 tabular-nums">
        <span className="font-medium text-white">{String(reachedCount(block, current)).padStart(2, '0')}</span>/{totalCount(block)}
        {short ? null : ' mobilisées'}
      </span>
    </div>
  );
}

/**
 * Tableau des 34 compétences, rangées comme dans le référentiel. À chaque session,
 * les compétences mobilisées passent à l'orange et gagnent un point ; celles des
 * sessions précédentes restent marquées.
 */
function StampBoard({ blocks, current, className }: { blocks: Block[]; current: number; className?: string }) {
  // Rang d'allumage de chaque compétence mobilisée : les cases s'allument en cascade.
  const ranks = new Map<string, number>();
  for (const block of blocks) {
    for (const group of block.groups) {
      for (const skill of group.skills) {
        if (skill.sessions.includes(current)) ranks.set(skill.name, ranks.size);
      }
    }
  }
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-white/10 bg-petrol-950/45 p-4 2xl:p-5', className)}>
      {/* Balayage à chaque changement de session */}
      <motion.span
        key={current}
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[18%] bg-gradient-to-r from-transparent via-orange-500/15 to-transparent"
        initial={{ x: '-110%', opacity: 1 }}
        animate={{ x: '620%', opacity: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
      <div className="space-y-5">
        {blocks.map((block) => (
          <div key={block.kind}>
            <BlockHeader block={block} current={current} />
            <div className="mt-2 space-y-1">
              {block.groups.map((group) => (
                <div key={group.name} className="grid grid-cols-[6.25rem_minmax(0,1fr)] gap-2">
                  <span className="self-center text-xs leading-tight text-white/60">{group.name}</span>
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${group.skills.length}, minmax(0, 1fr))` }}>
                    {group.skills.map((skill) => (
                      <Tile key={skill.name} skill={skill} current={current} rank={ranks.get(skill.name) ?? 0} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tile({ skill, current, rank }: { skill: JourneySkill; current: number; rank: number }) {
  const on = skill.sessions.includes(current);
  const marks = skill.sessions.filter((n) => n <= current);
  const done = !on && marks.length > 0;
  return (
    <motion.div
      initial={false}
      animate={on ? { scale: [1.08, 1] } : { scale: 1 }}
      transition={{ duration: 0.5, delay: on ? rank * 0.04 : 0, ease: EASE }}
      style={{ transitionDelay: on ? `${rank * 40}ms` : '0ms' }}
      className={cn(
        'flex min-h-[1.9rem] items-center justify-between gap-1.5 rounded-[5px] border px-2 py-1 text-[0.78rem] leading-[1.2] transition-colors duration-300',
        on
          ? 'border-orange-500 bg-orange-500 font-semibold text-petrol-950'
          : done
            ? 'border-petrol-600 bg-petrol-800 text-petrol-100'
            : 'border-white/10 text-white/55',
      )}
    >
      <span className="min-w-0">{skill.name}</span>
      {marks.length ? (
        <span className="flex shrink-0 gap-[3px]">
          {marks.map((n) => (
            <span
              key={n}
              className={cn('size-[7px] rounded-[2px]', on ? (n === current ? 'bg-petrol-950' : 'bg-petrol-950/35') : 'bg-petrol-400')}
            />
          ))}
        </span>
      ) : null}
    </motion.div>
  );
}

/** Version condensée (téléphone, tablette, fenêtre basse) : une case par compétence, une colonne par catégorie. */
function MiniBoard({ blocks, current, className }: { blocks: Block[]; current: number; className?: string }) {
  return (
    <div className={cn('flex gap-5', className)}>
      {blocks.map((block) => (
        <div key={block.kind} className="min-w-0" style={{ flex: block.groups.length }}>
          <BlockHeader block={block} current={current} short />
          <div className="mt-2 flex gap-1">
            {block.groups.map((group) => (
              <div key={group.name} className="flex min-w-0 flex-1 flex-col gap-1">
                {group.skills.map((skill) => {
                  const on = skill.sessions.includes(current);
                  const done = !on && skill.sessions.some((n) => n < current);
                  return (
                    <span
                      key={skill.name}
                      className={cn(
                        'aspect-square max-h-9 w-full rounded-[3px] border transition-colors duration-500',
                        on ? 'border-orange-500 bg-orange-500' : done ? 'border-petrol-500 bg-petrol-500' : 'border-white/15',
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Version sans animation (préférence « réduire les animations »). */
function StaticJourney({ sessions, skills }: { sessions: JourneySession[]; skills: JourneySkill[] }) {
  return (
    <ol className="container-site grid gap-px overflow-hidden py-10 sm:grid-cols-2 lg:grid-cols-3">
      {sessions.map((session) => {
        const mobilised = skillsOf(skills, session.number);
        return (
          <li key={session.number} className="border-t border-white/10 py-6 pr-6">
            <span className="font-display text-4xl font-semibold text-orange-500">{session.number}</span>
            <h3 className="mt-2 text-title text-white">{session.title}</h3>
            {session.summary ? <p className="mt-2 text-white/70">{session.summary}</p> : null}
            {session.is_provisional ? (
              <p className="mt-2 text-white/70">Le contenu de cette session sera publié avec le programme définitif.</p>
            ) : null}
            {mobilised.ct.length ? (
              <p className="mt-3 text-sm text-orange-200">{mobilised.ct.map((skill) => skill.name).join(', ')}</p>
            ) : null}
            {mobilised.hbs.length ? (
              <p className="mt-1.5 text-sm text-white/70">{mobilised.hbs.map((skill) => skill.name).join(', ')}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
