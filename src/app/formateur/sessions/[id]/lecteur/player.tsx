'use client';

import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardPen,
  Coffee,
  Eye,
  Hand,
  Lightbulb,
  ListOrdered,
  Maximize,
  MessageCircleQuestion,
  Minimize,
  NotebookPen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Speech,
  Target,
  Timer,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Markdown } from '@/components/markdown';
import { AutosaveTextarea } from '@/components/ui/autosave-textarea';
import { PART_LABELS, SEQUENCE_TYPE_LABELS, type PartKind, type SessionScript } from '@/lib/pedagogy/parse';
import { cn } from '@/lib/utils';

import { savePlayerState, saveTrainerNote } from './actions';

type TimerState = { elapsedMs: number; runningSince: number | null };
export type PlayerInitialState = {
  currentBlock: number;
  completedBlocks: number[];
  sessionTimer: TimerState;
  blockTimers: Record<string, TimerState>;
};

const PART_STYLES: Record<PartKind, { icon: typeof Speech; box: string; label: string; title: string }> = {
  say: { icon: Speech, box: 'border-l-4 border-petrol-700 bg-petrol-50', label: 'text-petrol-700', title: 'À dire au groupe' },
  do: { icon: Hand, box: 'border-l-4 border-orange-500 bg-orange-50', label: 'text-orange-700', title: 'Ce que font les participants' },
  observe: { icon: Eye, box: 'border-l-4 border-chart-observed bg-[#e6f4f7]', label: 'text-[#00687d]', title: 'À observer' },
  retain: { icon: Lightbulb, box: 'border-l-4 border-warning bg-warning-soft', label: 'text-warning', title: 'À retenir pour le formateur' },
  questions: { icon: MessageCircleQuestion, box: 'border-l-4 border-petrol-400 bg-white', label: 'text-petrol-600', title: 'Questions à poser' },
  objectives: { icon: Target, box: 'border-l-4 border-petrol-300 bg-white', label: 'text-petrol-600', title: 'Objectifs' },
  debrief: { icon: MessageCircleQuestion, box: 'border-l-4 border-petrol-400 bg-white', label: 'text-petrol-600', title: 'Débriefing' },
  transition: { icon: ChevronRight, box: 'border-l-4 border-line-strong bg-white', label: 'text-ink-muted', title: 'Transition' },
  skills: { icon: Target, box: 'border-l-4 border-petrol-300 bg-white', label: 'text-petrol-600', title: 'Compétences mobilisées' },
  material: { icon: ListOrdered, box: 'border-l-4 border-line-strong bg-white', label: 'text-ink-muted', title: 'Matériel' },
  content: { icon: ListOrdered, box: 'bg-white', label: 'text-ink-muted', title: 'Contenu' },
};

/** Temps écoulé ; `now` est nul tant que le composant n'est pas monté (rendu serveur identique au client). */
function elapsed(timer: TimerState, now: number | null) {
  return timer.elapsedMs + (timer.runningSince && now ? Math.max(0, now - timer.runningSince) : 0);
}

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function SessionPlayer({
  sessionId,
  sessionLabel,
  groupName,
  script,
  contentVersionId,
  isProvisional,
  initial,
  notes: initialNotes,
}: {
  sessionId: string;
  sessionLabel: string;
  groupName: string;
  script: SessionScript;
  contentVersionId: string | null;
  isProvisional: boolean;
  initial: PlayerInitialState;
  notes: Record<string, string>;
}) {
  const sequences = script.sequences;
  const hasPrep = script.info.length > 0 || Boolean(script.intro);
  // Index -1 : écran « Avant de commencer » (objectifs, compétences, avertissements).
  const [current, setCurrent] = useState(() => Math.max(hasPrep ? -1 : 0, Math.min(initial.currentBlock, sequences.length - 1)));
  const [completed, setCompleted] = useState<number[]>(initial.completedBlocks);
  const [sessionTimer, setSessionTimer] = useState<TimerState>(initial.sessionTimer);
  const [blockTimers, setBlockTimers] = useState<Record<string, TimerState>>(initial.blockTimers);
  const [now, setNow] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [panel, setPanel] = useState<'notes' | null>(null);
  const [direction, setDirection] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sequence = current >= 0 ? sequences[current] : null;
  const totalPlanned = script.totalMinutes;

  // Une horloge partagée suffit à faire avancer tous les chronomètres.
  useEffect(() => {
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  // Sauvegarde de la position et des chronomètres (reprise ultérieure).
  const persist = useCallback(
    (next: { current: number; completed: number[]; sessionTimer: TimerState; blockTimers: Record<string, TimerState> }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void savePlayerState({
          sessionId,
          contentVersionId,
          currentBlock: Math.max(0, next.current),
          completedBlocks: next.completed,
          sessionTimer: next.sessionTimer,
          blockTimers: next.blockTimers,
        });
      }, 600);
    },
    [sessionId, contentVersionId],
  );

  const commit = (patch: Partial<{ current: number; completed: number[]; sessionTimer: TimerState; blockTimers: Record<string, TimerState> }>) => {
    const next = { current, completed, sessionTimer, blockTimers, ...patch };
    if (patch.current !== undefined) setCurrent(patch.current);
    if (patch.completed) setCompleted(patch.completed);
    if (patch.sessionTimer) setSessionTimer(patch.sessionTimer);
    if (patch.blockTimers) setBlockTimers(patch.blockTimers);
    persist(next);
  };

  // Référence toujours à jour : deux appuis rapides sur une flèche avancent bien de deux séquences.
  // (toute navigation passe par go(), qui tient la référence à jour)
  const currentRef = useRef(current);
  const go = (target: number | ((value: number) => number)) => {
    const from = currentRef.current;
    const min = hasPrep ? -1 : 0;
    const bounded = Math.max(min, Math.min(sequences.length - 1, typeof target === 'function' ? target(from) : target));
    if (bounded === from) return;
    currentRef.current = bounded;
    setDirection(bounded > from ? 1 : -1);
    commit({ current: bounded });
    document.getElementById('lecteur-contenu')?.scrollTo({ top: 0 });
  };

  const toggleTimer = (timer: TimerState): TimerState =>
    timer.runningSince ? { elapsedMs: timer.elapsedMs + (Date.now() - timer.runningSince), runningSince: null } : { ...timer, runningSince: Date.now() };

  const toggleSession = () => commit({ sessionTimer: toggleTimer(sessionTimer) });
  const resetSession = () => {
    if (window.confirm('Remettre le chronomètre de session à zéro ?')) commit({ sessionTimer: { elapsedMs: 0, runningSince: null } });
  };

  const blockTimer = sequence ? (blockTimers[sequence.key] ?? { elapsedMs: 0, runningSince: null }) : null;
  const setBlockTimer = (timer: TimerState) => sequence && commit({ blockTimers: { ...blockTimers, [sequence.key]: timer } });

  const markDone = () => {
    if (!sequence) return;
    const done = completed.includes(sequence.index) ? completed.filter((i) => i !== sequence.index) : [...completed, sequence.index];
    commit({ completed: done, ...(done.includes(sequence.index) && current < sequences.length - 1 ? { current: current + 1 } : {}) });
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await rootRef.current?.requestFullscreen?.().catch(() => undefined);
    else await document.exitFullscreen().catch(() => undefined);
  };
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Raccourcis : ← → séquences, espace minuteur, F plein écran, N notes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        go((value) => value + 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        go((value) => value - 1);
      } else if (event.key === ' ' && blockTimer) {
        event.preventDefault();
        setBlockTimer(toggleTimer(blockTimer));
      } else if (event.key.toLowerCase() === 'f') {
        void toggleFullscreen();
      } else if (event.key.toLowerCase() === 'n') {
        setPanel((value) => (value ? null : 'notes'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sessionElapsed = elapsed(sessionTimer, now);
  const plannedUntilCurrent = useMemo(
    () => sequences.slice(0, Math.max(current, 0)).reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0),
    [sequences, current],
  );
  const behindMinutes = sessionTimer.elapsedMs > 0 || sessionTimer.runningSince ? Math.round(sessionElapsed / 60000 - plannedUntilCurrent) : 0;

  return (
    <div ref={rootRef} className="fixed inset-0 z-40 flex flex-col bg-paper text-ink">
      {/* Barre supérieure */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-petrol-900 px-3 text-white sm:px-5">
        <Link href={`/formateur/sessions/${sessionId}`} className="flex size-10 items-center justify-center rounded-md hover:bg-white/10" aria-label="Quitter le lecteur">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-semibold">{sessionLabel}</p>
          <p className="truncate text-xs text-white/60">{groupName}{isProvisional ? ' · support provisoire' : ''}</p>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-white/8 py-1 pr-1 pl-3" role="timer" aria-label={`Durée écoulée de la session : ${clock(sessionElapsed)}`}>
          <span className="font-display text-lg font-semibold tabular-nums">{clock(sessionElapsed)}</span>
          <span className="mr-1 hidden text-xs text-white/55 md:inline">/ {Math.floor(totalPlanned / 60)} h {String(totalPlanned % 60).padStart(2, '0')}</span>
          <button type="button" onClick={toggleSession} className="flex size-8 items-center justify-center rounded-sm hover:bg-white/10" aria-label={sessionTimer.runningSince ? 'Mettre en pause le chronomètre de session' : 'Démarrer le chronomètre de session'}>
            {sessionTimer.runningSince ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          </button>
          <button type="button" onClick={resetSession} className="hidden size-8 items-center justify-center rounded-sm hover:bg-white/10 sm:flex" aria-label="Remettre à zéro le chronomètre de session">
            <RotateCcw className="size-4" aria-hidden />
          </button>
        </div>
        <nav aria-label="Accès rapides" className="hidden items-center gap-1 lg:flex">
          <Link href={`/formateur/sessions/${sessionId}/presences`} target="_blank" className="flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-white/10">
            <ClipboardCheck className="size-4" aria-hidden />
            Présences
          </Link>
          <Link href={`/formateur/sessions/${sessionId}/evaluations`} target="_blank" className="flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-white/10">
            <ClipboardPen className="size-4" aria-hidden />
            Évaluations
          </Link>
        </nav>
        <button type="button" onClick={() => setPanel((value) => (value ? null : 'notes'))} aria-pressed={panel === 'notes'} className={cn('flex size-10 items-center justify-center rounded-md hover:bg-white/10', panel && 'bg-white/15')} aria-label="Notes privées (N)">
          <NotebookPen className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={() => void toggleFullscreen()} className="hidden size-10 items-center justify-center rounded-md hover:bg-white/10 sm:flex" aria-label={fullscreen ? 'Quitter le plein écran (F)' : 'Plein écran (F)'}>
          {fullscreen ? <Minimize className="size-5" aria-hidden /> : <Maximize className="size-5" aria-hidden />}
        </button>
      </header>

      {/* Progression : un segment par séquence, proportionnel à sa durée */}
      <div className="flex h-1.5 shrink-0 gap-px bg-petrol-950" aria-hidden>
        {sequences.map((item) => (
          <span
            key={item.key}
            style={{ flexGrow: item.durationMinutes ?? 5 }}
            className={cn('h-full transition-colors duration-500', completed.includes(item.index) ? 'bg-orange-500' : item.index === current ? 'bg-orange-300' : 'bg-white/15')}
          />
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Déroulé */}
        <nav aria-label="Déroulé de la session" className="hidden w-72 shrink-0 overflow-y-auto border-r border-line bg-white py-3 md:block">
          {hasPrep ? (
            <button type="button" onClick={() => go(-1)} aria-current={current === -1 ? 'step' : undefined} className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm', current === -1 ? 'bg-petrol-50 font-semibold' : 'hover:bg-paper')}>
              <Target className="size-4 text-petrol-500" aria-hidden />
              Avant de commencer
            </button>
          ) : null}
          <ol>
            {sequences.map((item) => {
              const done = completed.includes(item.index);
              const active = item.index === current;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => go(item.index)}
                    aria-current={active ? 'step' : undefined}
                    className={cn('flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors', active ? 'bg-petrol-50' : 'hover:bg-paper')}
                  >
                    <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold', done ? 'bg-orange-500 text-petrol-950' : active ? 'bg-petrol-900 text-white' : 'bg-paper text-ink-muted')}>
                      {done ? <Check className="size-3.5" strokeWidth={3} aria-label="Terminée" /> : item.index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block text-sm leading-snug', active ? 'font-semibold text-ink' : 'text-ink')}>{item.title}</span>
                      <span className="text-xs text-ink-subtle">
                        {SEQUENCE_TYPE_LABELS[item.type]}
                        {item.durationMinutes ? ` · ${item.durationMinutes} min` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Contenu de la séquence */}
        <main id="lecteur-contenu" className="min-w-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={current}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10"
            >
              {sequence ? (
                <>
                  <p className="text-sm font-medium text-ink-muted">
                    Séquence {sequence.index + 1} sur {sequences.length} · {SEQUENCE_TYPE_LABELS[sequence.type]}
                  </p>
                  <h1 className="mt-1 text-display-md">{sequence.title}</h1>
                  {sequence.objective && !/a renseigner|à renseigner/i.test(sequence.objective) ? (
                    <p className="mt-3 flex gap-2 text-ink-muted">
                      <Target className="mt-1 size-4 shrink-0 text-petrol-500" aria-hidden />
                      {sequence.objective}
                    </p>
                  ) : null}
                  {sequence.skills.length ? <p className="mt-2 text-sm text-ink-muted">Compétences mobilisées : {sequence.skills.join(', ')}</p> : null}

                  {sequence.durationMinutes && blockTimer ? (
                    <BlockTimer durationMinutes={sequence.durationMinutes} timer={blockTimer} now={now} onChange={setBlockTimer} isBreak={sequence.type === 'break'} />
                  ) : null}

                  <div className="mt-6 space-y-4">
                    {sequence.parts.length === 0 ? <p className="text-ink-muted">Aucun contenu pour cette séquence.</p> : null}
                    {sequence.parts.map((part, partIndex) => {
                      const style = PART_STYLES[part.kind];
                      return (
                        <section key={partIndex} className={cn('rounded-lg px-5 py-4', style.box, part.kind === 'content' && 'border border-line')}>
                          {part.kind !== 'content' || part.title ? (
                            <h2 className={cn('mb-2 flex items-center gap-2 text-sm font-semibold', style.label)}>
                              <style.icon className="size-4" aria-hidden />
                              {part.kind === 'content' ? part.title : (part.title ?? PART_LABELS[part.kind])}
                              {part.kind !== 'content' && part.title && part.title !== style.title ? <span className="sr-only">({style.title})</span> : null}
                            </h2>
                          ) : null}
                          <Markdown className={cn(part.kind === 'say' && 'text-[1.125rem] leading-relaxed')}>{part.markdown}</Markdown>
                        </section>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-ink-muted">Préparation</p>
                  <h1 className="mt-1 text-display-md">{script.title ?? sessionLabel}</h1>
                  {script.intro ? <Markdown className="mt-4">{script.intro}</Markdown> : null}
                  {script.meta.length ? (
                    <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      {script.meta.map((item) => (
                        <div key={item.label} className="flex gap-1.5">
                          <dt className="text-ink-muted">{item.label} :</dt>
                          <dd className="font-medium">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <div className="mt-6 space-y-4">
                    {script.info.map((info) => (
                      <section key={info.title} className="rounded-lg border border-line bg-white px-5 py-4">
                        <h2 className="mb-2 font-display font-semibold">{info.title}</h2>
                        <Markdown>{info.markdown}</Markdown>
                      </section>
                    ))}
                  </div>
                  <section className="mt-6 rounded-lg border border-line bg-white px-5 py-4">
                    <h2 className="mb-3 font-display font-semibold">Déroulé prévu</h2>
                    <ol className="space-y-1.5 text-[0.9375rem]">
                      {sequences.map((item) => (
                        <li key={item.key} className="flex justify-between gap-4">
                          <span>{item.index + 1}. {item.title}</span>
                          <span className="text-ink-muted tabular-nums">{item.durationMinutes ? `${item.durationMinutes} min` : '—'}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Notes privées */}
        <AnimatePresence>
          {panel === 'notes' ? (
            <motion.aside
              initial={{ x: 32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 32, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-y-16 right-0 z-10 w-full max-w-sm overflow-y-auto border-l border-line bg-white p-5 shadow-lg lg:static lg:inset-auto lg:shadow-none"
              aria-label="Notes privées"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display font-semibold">Notes privées</h2>
                <button type="button" onClick={() => setPanel(null)} className="flex size-8 items-center justify-center rounded-sm hover:bg-paper" aria-label="Fermer les notes">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <p className="mb-4 text-sm text-ink-muted">Visibles de vous seul, enregistrées automatiquement.</p>
              {sequence ? (
                <div className="mb-5">
                  <p className="mb-1.5 text-sm font-semibold">Séquence : {sequence.title}</p>
                  <AutosaveTextarea key={sequence.key} label={`Notes sur la séquence ${sequence.title}`} rows={6} maxLength={8000} initialValue={initialNotes[sequence.key] ?? ''} onSave={(body) => saveTrainerNote(sessionId, sequence.key, body)} />
                </div>
              ) : null}
              <p className="mb-1.5 text-sm font-semibold">Note générale de la session</p>
              <AutosaveTextarea label="Note générale de la session" rows={6} maxLength={8000} initialValue={initialNotes[''] ?? ''} onSave={(body) => saveTrainerNote(sessionId, '', body)} />
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <footer className="pb-safe flex shrink-0 items-center gap-2 border-t border-line bg-white px-3 pt-3 sm:px-5">
        <button type="button" onClick={() => go(current - 1)} disabled={current <= (hasPrep ? -1 : 0)} className="flex h-11 items-center gap-1.5 rounded-md border border-line-strong px-3 font-semibold text-ink hover:bg-paper disabled:opacity-40">
          <ChevronLeft className="size-5" aria-hidden />
          <span className="hidden sm:inline">Précédente</span>
        </button>
        <div className="min-w-0 flex-1 text-center text-sm text-ink-muted">
          {sequence ? (
            <>
              <span className="font-semibold text-ink">{sequence.index + 1}</span> / {sequences.length}
              {behindMinutes > 5 ? <span className="ml-2 text-warning">· {behindMinutes} min de retard sur le déroulé</span> : null}
            </>
          ) : (
            'Avant de commencer'
          )}
        </div>
        {sequence ? (
          <button type="button" onClick={markDone} className={cn('hidden h-11 items-center gap-1.5 rounded-md px-3 font-semibold sm:flex', completed.includes(sequence.index) ? 'bg-paper text-ink-muted' : 'border border-line-strong text-ink hover:bg-paper')}>
            <Check className="size-5" aria-hidden />
            {completed.includes(sequence.index) ? 'Terminée' : 'Marquer terminée'}
          </button>
        ) : null}
        {current < sequences.length - 1 ? (
          <button type="button" onClick={() => go(current + 1)} className="flex h-11 items-center gap-1.5 rounded-md bg-orange-500 px-4 font-semibold text-petrol-950 hover:bg-orange-400">
            <span>Suivante</span>
            <ChevronRight className="size-5" aria-hidden />
          </button>
        ) : (
          <Link href={`/formateur/sessions/${sessionId}/evaluations`} className="flex h-11 items-center gap-1.5 rounded-md bg-orange-500 px-4 font-semibold text-petrol-950 hover:bg-orange-400">
            <ClipboardPen className="size-5" aria-hidden />
            Évaluer les participants
          </Link>
        )}
      </footer>
    </div>
  );
}

/** Minuteur de séquence : compte à rebours depuis la durée prévue, dépassement signalé. */
function BlockTimer({ durationMinutes, timer, now, onChange, isBreak }: { durationMinutes: number; timer: TimerState; now: number | null; onChange: (timer: TimerState) => void; isBreak: boolean }) {
  const [extraMinutes, setExtraMinutes] = useState(0);
  const total = (durationMinutes + extraMinutes) * 60000;
  const spent = elapsed(timer, now);
  const remaining = total - spent;
  const ratio = Math.min(1, spent / total);
  const over = remaining < 0;
  const running = Boolean(timer.runningSince);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={cn('mt-6 flex flex-wrap items-center gap-4 rounded-xl border bg-white px-4 py-3 sm:px-5', over ? 'border-danger/40' : 'border-line')}>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden className="shrink-0 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#e5e5e0" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={over ? '#b42318' : isBreak ? '#47828d' : '#ea632e'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 0.5s linear' }}
        />
      </svg>
      <div className="min-w-0 flex-1" role="timer" aria-live="off">
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          {isBreak ? <Coffee className="size-4" aria-hidden /> : <Timer className="size-4" aria-hidden />}
          {over ? 'Temps dépassé' : running ? 'Temps restant' : spent > 0 ? 'En pause' : `Durée prévue : ${durationMinutes + extraMinutes} min`}
        </p>
        <p className={cn('font-display text-3xl leading-tight font-semibold tabular-nums', over && 'text-danger')}>
          {over ? '+' : ''}
          {clock(Math.abs(remaining))}
        </p>
      </div>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => setExtraMinutes((value) => value + 1)} className="flex h-11 items-center gap-1 rounded-md border border-line-strong px-3 text-sm font-semibold hover:bg-paper" aria-label="Ajouter une minute">
          <Plus className="size-4" aria-hidden />1 min
        </button>
        <button type="button" onClick={() => onChange({ elapsedMs: 0, runningSince: null })} className="flex size-11 items-center justify-center rounded-md border border-line-strong hover:bg-paper" aria-label="Réinitialiser le minuteur">
          <RotateCcw className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onChange(running ? { elapsedMs: spent, runningSince: null } : { ...timer, runningSince: Date.now() })}
          className={cn('flex h-11 items-center gap-1.5 rounded-md px-4 font-semibold', running ? 'bg-petrol-900 text-white hover:bg-petrol-800' : 'bg-orange-500 text-petrol-950 hover:bg-orange-400')}
          aria-label={running ? 'Mettre en pause le minuteur (espace)' : 'Démarrer le minuteur (espace)'}
        >
          {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {running ? 'Pause' : spent > 0 ? 'Reprendre' : 'Démarrer'}
        </button>
      </div>
    </div>
  );
}
