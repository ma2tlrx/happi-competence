'use client';

import { ArrowLeft, ArrowRight, CircleCheck, CloudCheck, LoaderCircle, Lock, Send, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { FrameworkSection, type EngineFramework, type FormState } from '@/app/formateur/sessions/[id]/evaluations/workspace';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import { Badge, Notice } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { deriveSkillScore } from '@/lib/evaluation-engine';
import { saveSecondRating, submitSecondRating, type Feedback, type SecondRatingPayload } from '@/lib/reliability/actions';
import { cn, formatDateTime, formatScore } from '@/lib/utils';

export type RatingEntry = {
  id: string;
  participantLabel: string;
  status: 'draft' | 'submitted';
  submittedAt: string | null;
  exerciseOpen: boolean;
  comment: string;
  criteria: Record<string, { observed: boolean | null; score: number | null }>;
  scores: Record<string, { score: number | null; comment: string }>;
  feedback: Feedback | null;
};

type Form = { scores: FormState['scores']; criteria: FormState['criteria']; comment: string };

function buildPayload(ratingId: string, form: Form, frameworks: EngineFramework[]): SecondRatingPayload {
  const scores: SecondRatingPayload['scores'] = [];
  for (const framework of frameworks) {
    const derived = framework.rules.scoringMode !== 'direct';
    for (const skill of framework.skills) {
      const entry = form.scores[skill.id];
      const score = derived
        ? deriveSkillScore(framework.rules, skill.criteria.map((c) => ({ weight: c.weight, observed: form.criteria[c.id]?.observed ?? null, score: form.criteria[c.id]?.score ?? null })))
        : (entry?.score ?? null);
      const comment = entry?.comment?.trim() || null;
      if (score !== null || comment || entry) scores.push({ skill_id: skill.id, score, source: derived ? 'derived' : 'direct', comment });
    }
  }
  return { ratingId, scores, criteria: form.criteria, comment: form.comment };
}

/**
 * Seconde cotation : même présentation que l'évaluation officielle (compétences, niveaux,
 * descripteurs, critères), sauvegarde automatique, soumission explicite et définitive.
 */
export function SecondRatingWorkspace({ frameworks, ratings: initial }: { frameworks: EngineFramework[]; ratings: RatingEntry[] }) {
  const router = useRouter();
  const [ratings, setRatings] = useState(initial);
  const [currentId, setCurrentId] = useState(initial.find((r) => r.status === 'draft')?.id ?? initial[0]!.id);
  const [forms, setForms] = useState<Record<string, Form>>(() => Object.fromEntries(initial.map((r) => [r.id, { scores: r.scores, criteria: r.criteria, comment: r.comment }])));
  const [saveState, setSaveState] = useState<{ status: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'; message?: string }>({ status: 'idle' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, startSubmitting] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<(() => Promise<void>) | null>(null);

  const rating = ratings.find((r) => r.id === currentId)!;
  const form = forms[currentId]!;
  const locked = rating.status === 'submitted' || !rating.exerciseOpen;
  const index = ratings.findIndex((r) => r.id === currentId);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const run = pendingSave.current;
    pendingSave.current = null;
    if (run) await run();
  }, []);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (pendingSave.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, []);

  const update = (mutate: (draft: Form) => Form) => {
    if (locked) return;
    const next = mutate(form);
    const ratingId = currentId;
    setForms((all) => ({ ...all, [ratingId]: next }));
    setSaveState({ status: 'dirty' });
    pendingSave.current = async () => {
      setSaveState({ status: 'saving' });
      const result = await saveSecondRating(buildPayload(ratingId, next, frameworks));
      setSaveState(result.ok ? { status: 'saved' } : { status: 'error', message: result.message });
    };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1200);
  };

  const goTo = async (id: string) => {
    await flush();
    setSaveState({ status: 'idle' });
    setCurrentId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const payload = buildPayload(currentId, form, frameworks);
  const scoredCount = payload.scores.filter((s) => s.score !== null).length;
  const totalSkills = frameworks.reduce((sum, f) => sum + f.skills.length, 0);

  const submit = () =>
    startSubmitting(async () => {
      if (timer.current) clearTimeout(timer.current);
      pendingSave.current = null;
      const result = await submitSecondRating(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setConfirmOpen(false);
      setRatings((all) => all.map((r) => (r.id === currentId ? { ...r, status: 'submitted', submittedAt: new Date().toISOString(), feedback: result.feedback } : r)));
      toast.success(`Seconde cotation de ${rating.participantLabel} soumise.`);
      router.refresh();
    });

  const formState: FormState = { scores: form.scores, criteria: form.criteria, comments: { observation: '', advice: '', private: '' } };

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <nav aria-label="Participants à coter" className="lg:sticky lg:top-20 lg:self-start">
        <ul className="hidden space-y-0.5 rounded-lg border border-line bg-white p-2 lg:block">
          {ratings.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => void goTo(r.id)}
                aria-current={r.id === currentId ? 'true' : undefined}
                className={cn(
                  'flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[0.9375rem] transition-colors',
                  r.id === currentId ? 'bg-petrol-900 text-white' : 'text-ink hover:bg-petrol-50',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{r.participantLabel}</span>
                {r.status === 'submitted' ? <CircleCheck className={cn('size-4 shrink-0', r.id === currentId ? 'text-orange-400' : 'text-success')} aria-label="Soumise" /> : null}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 lg:hidden">
          <Button variant="outline" size="icon" onClick={() => void goTo(ratings[(index - 1 + ratings.length) % ratings.length]!.id)} aria-label="Participant précédent">
            <ArrowLeft aria-hidden />
          </Button>
          <select
            aria-label="Choisir le participant"
            value={currentId}
            onChange={(event) => void goTo(event.target.value)}
            className="h-10 min-w-0 flex-1 rounded-md border border-line-strong bg-white px-3 text-[0.9375rem]"
          >
            {ratings.map((r) => (
              <option key={r.id} value={r.id}>
                {r.participantLabel}
                {r.status === 'submitted' ? ' — soumise' : ''}
              </option>
            ))}
          </select>
          <Button variant="outline" size="icon" onClick={() => void goTo(ratings[(index + 1) % ratings.length]!.id)} aria-label="Participant suivant">
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </nav>

      <section aria-labelledby="seconde-titre" className="min-w-0 space-y-5 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-5 py-4">
          <div>
            <h2 id="seconde-titre" className="text-title">{rating.participantLabel}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {rating.status === 'submitted' ? <Badge variant="petrol" icon={Lock}>Soumise</Badge> : <Badge variant="outline">Brouillon</Badge>}
              <span className="text-sm text-ink-subtle">{scoredCount}/{totalSkills} compétences cotées</span>
            </div>
          </div>
          <SaveIndicator state={saveState} submittedAt={rating.status === 'submitted' ? rating.submittedAt : null} />
        </div>

        {!rating.exerciseOpen && rating.status !== 'submitted' ? <Notice variant="warning" title="Exercice clos">Cette cotation ne peut plus être modifiée ni soumise.</Notice> : null}
        {rating.status === 'submitted' ? <FeedbackPanel frameworks={frameworks} form={form} feedback={rating.feedback} /> : null}

        {frameworks.map((framework) => (
          <FrameworkSection
            key={framework.versionId}
            framework={framework}
            form={formState}
            locked={locked}
            onScore={(skillId, score) => update((d) => ({ ...d, scores: { ...d.scores, [skillId]: { score, comment: d.scores[skillId]?.comment ?? '' } } }))}
            onSkillComment={(skillId, comment) => update((d) => ({ ...d, scores: { ...d.scores, [skillId]: { score: d.scores[skillId]?.score ?? null, comment } } }))}
            onCriterion={(criterionId, value) => update((d) => ({ ...d, criteria: { ...d.criteria, [criterionId]: value } }))}
          />
        ))}

        <section className="rounded-lg border border-line bg-white p-5" aria-labelledby="note-seconde">
          <h3 id="note-seconde" className="text-title">Note du second observateur</h3>
          <Field label="Remarque libre" hint="Réservée à l’administrateur (préparation de l’étalonnage). Jamais visible du participant, de son organisme ni du formateur officiel." className="mt-3">
            {({ id, describedBy }) => (
              <Textarea id={id} aria-describedby={describedBy} rows={3} maxLength={2000} value={form.comment} disabled={locked} onChange={(event) => update((d) => ({ ...d, comment: event.target.value }))} />
            )}
          </Field>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur-md lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => void goTo(ratings[(index + 1) % ratings.length]!.id)}>
              Suivant
              <ArrowRight aria-hidden />
            </Button>
            {!locked ? (
              <Button onClick={() => setConfirmOpen(true)} disabled={scoredCount === 0}>
                <Send aria-hidden />
                Soumettre la cotation
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent title="Soumettre la seconde cotation ?" description="Une cotation soumise est définitive. Vous verrez ensuite les niveaux de l’évaluation officielle validée pour comparer.">
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Annuler</Button>
            <Button onClick={submit} loading={submitting}>Soumettre</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaveIndicator({ state, submittedAt }: { state: { status: string; message?: string }; submittedAt: string | null }) {
  if (submittedAt) return <span className="text-sm text-ink-muted">Soumise le {formatDateTime(submittedAt)}</span>;
  const content = {
    idle: null,
    dirty: <><LoaderCircle className="size-4 text-ink-subtle" aria-hidden />Modifications en attente</>,
    saving: <><LoaderCircle className="size-4 animate-spin" aria-hidden />Enregistrement…</>,
    saved: <><CloudCheck className="size-4 text-success" aria-hidden />Brouillon enregistré</>,
    error: <><TriangleAlert className="size-4 text-danger" aria-hidden />{state.message ?? 'Brouillon non enregistré'}</>,
  }[state.status as 'idle' | 'dirty' | 'saving' | 'saved' | 'error'];
  return <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted" aria-live="polite">{content}</span>;
}

/** Comparaison après soumission : niveau officiel validé et niveau coté en second, par compétence. */
function FeedbackPanel({ frameworks, form, feedback }: { frameworks: EngineFramework[]; form: Form; feedback: Feedback | null }) {
  if (!feedback?.validated) {
    return <Notice title="Comparaison pas encore disponible">L’évaluation officielle n’est pas encore validée. La comparaison apparaîtra ici dès sa validation.</Notice>;
  }
  const rows = frameworks.flatMap((framework) =>
    framework.skills.map((skill) => {
      const mine = framework.rules.scoringMode === 'direct'
        ? (form.scores[skill.id]?.score ?? null)
        : deriveSkillScore(framework.rules, skill.criteria.map((c) => ({ weight: c.weight, observed: form.criteria[c.id]?.observed ?? null, score: form.criteria[c.id]?.score ?? null })));
      return { id: skill.id, name: skill.name, official: feedback.scores[skill.id] ?? null, mine };
    }),
  ).filter((row) => row.official !== null || row.mine !== null);
  return (
    <section className="rounded-lg border border-line bg-white p-5" aria-labelledby="comparaison-titre">
      <h3 id="comparaison-titre" className="text-title">Comparaison avec l’évaluation officielle</h3>
      <p className="mt-1 text-sm text-ink-muted">Pour vous étalonner : un écart n’est pas une erreur en soi, il signale un point à discuter entre formateurs.</p>
      <ul className="mt-4 divide-y divide-line">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="font-medium text-ink">{row.name}</span>
            <span className="text-ink-muted">
              Officielle : <strong className="text-ink">{row.official === null ? 'non observée' : formatScore(row.official)}</strong> · Vous :{' '}
              <strong className="text-ink">{row.mine === null ? 'non observée' : formatScore(row.mine)}</strong>
              {row.official !== null && row.mine !== null && row.official !== row.mine ? <Badge variant="orange" className="ml-2">écart {formatScore(Math.abs(row.official - row.mine))}</Badge> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
