'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { useInView } from 'motion/react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';

import { LevelMeter, SessionSteps } from '@/components/ui/level-meter';
import { cn } from '@/lib/utils';

import { usePrefersReducedMotion } from './use-motion-preference';

// Recharts n'est chargé qu'à l'affichage de la démonstration.
const SkillRadar = dynamic(() => import('@/components/passport/skill-radar').then((module) => module.SkillRadar), {
  ssr: false,
  loading: () => <div className="skeleton h-[30rem] w-full" aria-hidden />,
});

export type DemoSkill = { code: string; name: string; sessions: number[] };
export type DemoFramework = {
  code: string;
  name: string;
  shortName: string;
  min: number;
  max: number;
  levels: { value: number; label: string }[];
  skills: DemoSkill[];
};
export type DemoSession = { number: number; title: string; provisional: boolean };

/*
 * Commentaires d'illustration, un par session du parcours d'exemple.
 * Ils sont fictifs, comme les niveaux affichés : la démonstration le signale à l'écran.
 */
const SAMPLE_COMMENTS: Record<number, string> = {
  1: 'Reformule la consigne pour le groupe avant de lancer la partie.',
  2: 'Garde son calme quand le chronomètre s’accélère et redistribue les tâches.',
  3: 'Propose un plan, puis laisse chacun choisir son rôle.',
  4: 'Cherche la cause de l’échec avant de relancer une tentative.',
  5: 'Termine sa mission dans le temps imparti sans attendre d’aide.',
};

function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** Niveaux fictifs, stables d'une visite à l'autre : dérivés du code de la compétence. */
function sample(skill: DemoSkill, framework: DemoFramework) {
  const seed = hash(skill.code);
  const span = framework.max - framework.min;
  const final = framework.min + 1 + (seed % span);
  const self = Math.min(framework.max, Math.max(framework.min, final + ((seed >>> 5) % 3) - 1));
  return { final, self };
}

/** Niveau observé après la session `step` : la compétence apparaît à sa première session, puis progresse. */
function observedAt(skill: DemoSkill, framework: DemoFramework, step: number) {
  const seen = skill.sessions.filter((number) => number <= step).length;
  if (seen === 0) return null;
  return Math.max(framework.min, sample(skill, framework).final - (skill.sessions.length - seen));
}

/**
 * Démonstration du passeport : un parcours d'exemple que l'on fait avancer session
 * par session. Elle réutilise les composants de l'espace participant (radar, jauges)
 * avec des niveaux fictifs, répartis selon la correspondance sessions / compétences publiée.
 */
export function PassportDemo({ frameworks, sessions }: { frameworks: DemoFramework[]; sessions: DemoSession[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const last = sessions.length;
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState(0);
  // Choix explicite du visiteur (lecture ou pause) ; tant qu'il n'a rien choisi, le parcours
  // se lit une fois à l'arrivée dans l'écran, sauf si l'on préfère réduire les animations.
  const [intent, setIntent] = useState<boolean | null>(null);
  // La lecture s'arrête à la dernière session qui apporte des observations (une session au thème
  // encore provisoire reste consultable, mais n'ajoute rien au passeport).
  const end = useMemo(() => {
    const numbers = frameworks.flatMap((item) => item.skills.flatMap((skill) => skill.sessions));
    return numbers.length ? Math.min(last, Math.max(...numbers)) : last;
  }, [frameworks, last]);
  const playing = (intent ?? (inView && !reduce)) && step < end;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setStep((value) => Math.min(end, value + 1)), step === 0 ? 1100 : 1700);
    return () => window.clearTimeout(timer);
  }, [playing, step, end]);

  const framework = frameworks[tab] ?? frameworks[0];
  const session = sessions.find((item) => item.number === step) ?? null;

  const radar = useMemo(
    () =>
      framework
        ? framework.skills.map((skill) => ({
            name: skill.name,
            observed: observedAt(skill, framework, step),
            self: sample(skill, framework).self,
          }))
        : [],
    [framework, step],
  );
  const observedCount = useMemo(
    () => frameworks.reduce((total, item) => total + item.skills.filter((skill) => skill.sessions.some((number) => number <= step)).length, 0),
    [frameworks, step],
  );
  const totalCount = frameworks.reduce((total, item) => total + item.skills.length, 0);

  if (!framework) return null;

  const levelLabel = (value: number | null) => framework.levels.find((level) => level.value === value)?.label ?? null;
  const sessionSkills = framework.skills.filter((skill) => skill.sessions.includes(step));
  const comment = session ? SAMPLE_COMMENTS[session.number] : undefined;

  const choose = (next: number) => {
    setIntent(false);
    setStep(next);
  };
  const togglePlay = () => {
    if (playing) return setIntent(false);
    if (step >= end) setStep(0);
    setIntent(true);
  };

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-line-strong bg-white shadow-lg">
      {/* En-tête de la fiche */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-8">
        <div>
          <p className="text-sm text-ink-subtle">Passeport de compétences</p>
          <p className="font-display text-lg font-semibold text-ink">Parcours d’exemple</p>
        </div>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">Exemple fictif</span>
      </div>

      {/* Avancement dans le programme */}
      <div className="border-b border-line bg-paper px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-petrol-900 px-4 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-petrol-800"
          >
            {playing ? <Pause className="size-4" aria-hidden /> : step >= end ? <RotateCcw className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {playing ? 'Mettre en pause' : step >= end ? 'Rejouer le parcours' : 'Lire le parcours'}
          </button>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Moment du parcours">
            {[{ number: 0, label: 'Départ' }, ...sessions.map((item) => ({ number: item.number, label: `S${item.number}` }))].map((item) => (
              <button
                key={item.number}
                type="button"
                onClick={() => choose(item.number)}
                aria-pressed={step === item.number}
                aria-label={item.number === 0 ? 'Départ, avant la première session' : `Après la session ${item.number}`}
                className={cn(
                  'h-10 min-w-11 rounded-md border px-3 font-mono text-sm transition-colors',
                  step === item.number
                    ? 'border-orange-500 bg-orange-500 font-medium text-petrol-950'
                    : item.number < step
                      ? 'border-petrol-200 bg-petrol-100 text-petrol-900 hover:border-petrol-400'
                      : 'border-line-strong bg-white text-ink-muted hover:border-petrol-400',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <SessionSteps total={last} completed={step} className="mt-4" />
        {/* Annoncé seulement hors lecture automatique : sinon un message toutes les deux secondes. */}
        <p className="mt-3 min-h-12 text-[0.9375rem] text-ink-muted sm:min-h-6" aria-live={playing ? 'off' : 'polite'}>
          {step === 0 ? (
            <>
              <span className="font-semibold text-ink">Avant la première session.</span> Seule l’auto-évaluation est renseignée.
            </>
          ) : (
            <>
              <span className="font-semibold text-ink">
                Après la session {step}
                {session ? ` · ${session.title}` : ''}.
              </span>{' '}
              {observedCount} compétences observées sur {totalCount}.
            </>
          )}
        </p>
      </div>

      <div className="grid gap-x-10 gap-y-8 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.2fr_1fr]">
        {/* Radar : auto-évaluation de départ et observations cumulées */}
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Référentiel affiché">
            {frameworks.map((item, index) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setTab(index)}
                aria-pressed={tab === index}
                className={cn(
                  'h-10 rounded-md border px-3.5 text-[0.9375rem] font-semibold transition-colors',
                  tab === index ? 'border-petrol-900 bg-petrol-900 text-white' : 'border-line-strong text-ink-muted hover:border-petrol-400 hover:text-ink',
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
          <SkillRadar
            key={framework.code}
            data={radar}
            min={framework.min}
            max={framework.max}
            showSelf
            wrapLabels
            height={440}
            title={`${framework.name} du parcours d’exemple${step === 0 ? ', avant la première session' : `, après la session ${step}`}`}
          />
        </div>

        {/* Ce que la session apporte au passeport */}
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-ink">
            {step === 0 ? 'Le point de départ' : session?.provisional ? `Session ${step} : thème à préciser` : `Observé en session ${step}`}
          </h3>
          {step === 0 ? (
            <p className="mt-3 text-ink-muted">
              Le parcours commence par un questionnaire d’auto-évaluation. Il reste affiché tel quel, en orange, pour comparer ce que la
              personne pense d’elle-même et ce que les formateurs observent ensuite.
            </p>
          ) : sessionSkills.length ? (
            <div className="mt-4 space-y-4">
              {sessionSkills.map((skill) => {
                const value = observedAt(skill, framework, step);
                const label = levelLabel(value);
                return (
                  <div key={skill.code}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-4">
                      <span className="font-medium text-ink">{skill.name}</span>
                      <span className="shrink-0 text-sm text-ink-muted">
                        <span className="font-mono font-medium text-ink tabular-nums">
                          {value}/{framework.max}
                        </span>
                        {label ? ` · ${label}` : null}
                      </span>
                    </div>
                    <LevelMeter
                      value={value}
                      min={framework.min}
                      max={framework.max}
                      label={`${skill.name} : niveau ${value} sur ${framework.max}${label ? `, ${label}` : ''}`}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-ink-muted">
              {session?.provisional
                ? 'Les compétences de cette session seront publiées avec le programme définitif.'
                : `Aucune compétence de ce référentiel n’est associée à la session ${step}.`}
            </p>
          )}
          {step > 0 && comment && sessionSkills.length ? (
            <figure className="mt-6 rounded-lg bg-paper p-4">
              <blockquote className="text-ink">« {comment} »</blockquote>
              <figcaption className="mt-2 text-sm text-ink-muted">Commentaire du formateur, partagé avec le participant</figcaption>
            </figure>
          ) : null}
          <ul className="mt-6 space-y-2.5 border-t border-line pt-5 text-[0.9375rem] text-ink-muted">
            {[
              'Chaque observation est rattachée à une session du programme.',
              'L’auto-évaluation de départ est conservée telle quelle.',
              'Le participant lit les commentaires que les formateurs partagent avec lui.',
            ].map((fact) => (
              <li key={fact} className="flex gap-3">
                <span className="mt-[0.6rem] h-1.5 w-3 shrink-0 rounded-[2px] bg-petrol-400" aria-hidden />
                {fact}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
