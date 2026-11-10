'use client';

import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, CircleCheck, CloudCheck, History, Keyboard, LoaderCircle, Lock, MessageSquarePlus, Pencil, TriangleAlert, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { AttendanceBadge } from '@/components/passport/session-status';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, InfoHint } from '@/components/ui/overlays';
import { Avatar, Badge, Notice, ProvisionalBadge } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { deriveSkillScore, scaleValues, SCORING_MODE_LABELS, type FrameworkRules } from '@/lib/evaluation-engine';
import { cn, formatDateTime, formatScore } from '@/lib/utils';

import { amendEvaluation, saveDraft, validateEvaluation, type EvaluationPayload } from './actions';

export type EngineSkill = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  descriptors: Record<number, string>;
  criteria: { id: string; label: string; description: string | null; weight: number }[];
};
export type EngineFramework = {
  versionId: string;
  code: string;
  name: string;
  versionLabel: string;
  isProvisional: boolean;
  mappingDefined: boolean;
  rules: FrameworkRules;
  levels: { value: number; label: string }[];
  skills: EngineSkill[];
};
type HistoryEntry = { id: number; type: string; subject: string | null; oldValue: string | null; newValue: string | null; reason: string | null; author: string | null; at: string };
export type ExistingEvaluation = {
  id: string;
  status: 'draft' | 'validated';
  revision: number;
  validatedAt: string | null;
  updatedAt: string;
  evaluator: string | null;
  versionIds: string[];
  scores: Record<string, { score: number | null; comment: string }>;
  criteria: Record<string, { observed: boolean | null; score: number | null }>;
  comments: { observation: string; advice: string; private: string };
  history: HistoryEntry[];
};
type Member = { id: string; name: string; firstName: string; lastName: string; attendance: string | null };

type FormState = {
  scores: Record<string, { score: number | null; comment: string }>;
  criteria: Record<string, { observed: boolean | null; score: number | null }>;
  comments: { observation: string; advice: string; private: string };
};

const emptyForm = (): FormState => ({ scores: {}, criteria: {}, comments: { observation: '', advice: '', private: '' } });
const formFrom = (evaluation: ExistingEvaluation | undefined): FormState =>
  evaluation ? { scores: { ...evaluation.scores }, criteria: { ...evaluation.criteria }, comments: { ...evaluation.comments } } : emptyForm();
const ATTENDED = ['present', 'late', 'left_early'];

function buildPayload(sessionId: string, participantId: string, form: FormState, frameworks: EngineFramework[]): EvaluationPayload {
  const scores: EvaluationPayload['scores'] = [];
  const criteria: EvaluationPayload['criteria'] = [];
  for (const framework of frameworks) {
    const derived = framework.rules.scoringMode !== 'direct';
    for (const skill of framework.skills) {
      const entry = form.scores[skill.id];
      const derivedScore = derived
        ? deriveSkillScore(
            framework.rules,
            skill.criteria.map((criterion) => ({ weight: criterion.weight, observed: form.criteria[criterion.id]?.observed ?? null, score: form.criteria[criterion.id]?.score ?? null })),
          )
        : null;
      const score = derived ? derivedScore : (entry?.score ?? null);
      const comment = entry?.comment?.trim() || null;
      if (score !== null || comment || entry) scores.push({ skill_id: skill.id, score, source: derived ? 'derived' : 'direct', comment });
      for (const criterion of skill.criteria) {
        const value = form.criteria[criterion.id];
        if (value) criteria.push({ criterion_id: criterion.id, observed: value.observed, score: value.score });
      }
    }
  }
  return { sessionId, participantId, scores, criteria, comments: form.comments };
}

export function EvaluationWorkspace({
  sessionId,
  sessionStatus,
  members,
  frameworks,
  existing: initialExisting,
  canWrite,
  initialParticipant,
}: {
  sessionId: string;
  sessionStatus: string;
  members: Member[];
  frameworks: EngineFramework[];
  existing: Record<string, ExistingEvaluation>;
  canWrite: boolean;
  initialParticipant: string | null;
}) {
  const router = useRouter();
  const [existing, setExisting] = useState(initialExisting);
  const firstToDo = members.find((member) => existing[member.id]?.status !== 'validated' && (!member.attendance || ATTENDED.includes(member.attendance)));
  const [currentId, setCurrentId] = useState(initialParticipant ?? firstToDo?.id ?? members[0]!.id);
  const [forms, setForms] = useState<Record<string, FormState>>(() => Object.fromEntries(members.map((member) => [member.id, formFrom(initialExisting[member.id])])));
  const [saveState, setSaveState] = useState<{ status: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'; at?: string; message?: string }>({ status: 'idle' });
  const [editing, setEditing] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [validating, startValidating] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<(() => Promise<void>) | null>(null);

  const current = members.find((member) => member.id === currentId)!;
  const evaluation = existing[currentId];
  const form = forms[currentId] ?? emptyForm();
  const validated = evaluation?.status === 'validated';
  const locked = !canWrite || (validated && !editing);
  const index = members.findIndex((member) => member.id === currentId);
  const usableFrameworks = useMemo(
    () => frameworks.filter((framework) => !evaluation || evaluation.versionIds.length === 0 || evaluation.versionIds.includes(framework.versionId)),
    [frameworks, evaluation],
  );
  const otherVersion = frameworks.length !== usableFrameworks.length;

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const run = pendingSave.current;
    pendingSave.current = null;
    if (run) await run();
  }, []);

  // Sauvegarde automatique du brouillon, 1,2 s après la dernière modification.
  const scheduleSave = (participantId: string, nextForm: FormState) => {
    if (!canWrite || existing[participantId]?.status === 'validated') return;
    setSaveState({ status: 'dirty' });
    pendingSave.current = async () => {
      setSaveState({ status: 'saving' });
      const result = await saveDraft(buildPayload(sessionId, participantId, nextForm, frameworks));
      if (result.ok) {
        setSaveState({ status: 'saved', at: result.savedAt });
        setExisting((all) => ({
          ...all,
          [participantId]: all[participantId] ?? { id: result.evaluationId, status: 'draft', revision: 0, validatedAt: null, updatedAt: result.savedAt, evaluator: null, versionIds: [], scores: {}, criteria: {}, comments: { observation: '', advice: '', private: '' }, history: [] },
        }));
      } else setSaveState({ status: 'error', message: result.message });
    };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1200);
  };

  const update = (mutate: (draft: FormState) => FormState) => {
    if (locked) return;
    const next = mutate(form);
    setForms((all) => ({ ...all, [currentId]: next }));
    scheduleSave(currentId, next);
  };

  const setScore = (skillId: string, score: number | null) =>
    update((draft) => ({ ...draft, scores: { ...draft.scores, [skillId]: { score, comment: draft.scores[skillId]?.comment ?? '' } } }));
  const setSkillComment = (skillId: string, comment: string) =>
    update((draft) => ({ ...draft, scores: { ...draft.scores, [skillId]: { score: draft.scores[skillId]?.score ?? null, comment } } }));
  const setCriterion = (criterionId: string, value: { observed: boolean | null; score: number | null }) =>
    update((draft) => ({ ...draft, criteria: { ...draft.criteria, [criterionId]: value } }));
  const setComment = (kind: keyof FormState['comments'], value: string) => update((draft) => ({ ...draft, comments: { ...draft.comments, [kind]: value } }));

  const goTo = async (participantId: string) => {
    await flush();
    setEditing(false);
    setSaveState({ status: 'idle' });
    setCurrentId(participantId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const next = () => goTo(members[(index + 1) % members.length]!.id);
  const previous = () => goTo(members[(index - 1 + members.length) % members.length]!.id);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        void next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void previous();
      }
    };
    window.addEventListener('keydown', onKey);
    const onLeave = (event: BeforeUnloadEvent) => {
      if (pendingSave.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onLeave);
    };
  });

  const payload = buildPayload(sessionId, currentId, form, usableFrameworks);
  const scoredCount = payload.scores.filter((score) => score.score !== null).length;
  const totalSkills = usableFrameworks.reduce((sum, framework) => sum + framework.skills.length, 0);

  const validate = () =>
    startValidating(async () => {
      if (timer.current) clearTimeout(timer.current);
      pendingSave.current = null;
      const result = await validateEvaluation(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setExisting((all) => ({ ...all, [currentId]: { ...(all[currentId] ?? ({} as ExistingEvaluation)), ...formFrom(undefined), ...form, id: result.evaluationId, status: 'validated', validatedAt: result.savedAt, updatedAt: result.savedAt, revision: 0, evaluator: null, versionIds: usableFrameworks.map((f) => f.versionId), history: [] } }));
      toast.success(`Évaluation de ${current.firstName} validée.`);
      router.refresh();
      const following = members.slice(index + 1).concat(members.slice(0, index)).find((member) => existing[member.id]?.status !== 'validated' && member.id !== currentId && (!member.attendance || ATTENDED.includes(member.attendance)));
      if (following) void goTo(following.id);
    });

  const submitAmendment = () =>
    startValidating(async () => {
      const result = await amendEvaluation(evaluation!.id, reason, payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.changes ? `${result.changes} modification(s) enregistrée(s) et tracée(s).` : 'Aucune valeur n’a changé.');
      setAmendOpen(false);
      setEditing(false);
      setReason('');
      router.refresh();
    });

  const cancelEdit = () => {
    setForms((all) => ({ ...all, [currentId]: formFrom(existing[currentId]) }));
    setEditing(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* Liste des participants */}
      <nav aria-label="Participants à évaluer" className="lg:sticky lg:top-20 lg:self-start">
        <div className="hidden rounded-lg border border-line bg-white p-2 lg:block">
          <ul className="space-y-0.5">
            {members.map((member) => {
              const status = existing[member.id]?.status;
              const absent = member.attendance && !ATTENDED.includes(member.attendance);
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => void goTo(member.id)}
                    aria-current={member.id === currentId ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[0.9375rem] transition-colors',
                      member.id === currentId ? 'bg-petrol-900 text-white' : 'text-ink hover:bg-petrol-50',
                      absent && member.id !== currentId && 'text-ink-subtle',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{member.lastName.toUpperCase()} {member.firstName}</span>
                    {status === 'validated' ? (
                      <CircleCheck className={cn('size-4 shrink-0', member.id === currentId ? 'text-orange-400' : 'text-success')} aria-label="Validée" />
                    ) : status === 'draft' ? (
                      <span className="size-2 shrink-0 rounded-full bg-orange-500" aria-label="Brouillon" />
                    ) : absent ? (
                      <span className="text-xs">absent</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 border-t border-line px-2.5 pt-2 text-xs text-ink-subtle">
            {Object.values(existing).filter((e) => e.status === 'validated').length}/{members.length} validées
          </p>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <Button variant="outline" size="icon" onClick={() => void previous()} aria-label="Participant précédent">
            <ArrowLeft aria-hidden />
          </Button>
          <select
            aria-label="Choisir le participant"
            value={currentId}
            onChange={(event) => void goTo(event.target.value)}
            className="h-10 min-w-0 flex-1 rounded-md border border-line-strong bg-white px-3 text-[0.9375rem]"
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.lastName.toUpperCase()} {member.firstName}
                {existing[member.id]?.status === 'validated' ? ' — validée' : existing[member.id]?.status === 'draft' ? ' — brouillon' : ''}
              </option>
            ))}
          </select>
          <Button variant="outline" size="icon" onClick={() => void next()} aria-label="Participant suivant">
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </nav>

      {/* Formulaire d'évaluation */}
      <motion.section key={currentId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} aria-labelledby="evaluation-titre" className="min-w-0 space-y-5 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar person={{ first_name: current.firstName, last_name: current.lastName }} size="lg" />
            <div>
              <h2 id="evaluation-titre" className="text-title">{current.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <AttendanceBadge status={current.attendance} />
                {validated ? <Badge variant="petrol" icon={Lock}>Validée{evaluation.revision ? ` · ${evaluation.revision} modif.` : ''}</Badge> : evaluation ? <Badge variant="outline">Brouillon</Badge> : <Badge variant="outline">À évaluer</Badge>}
                <span className="text-sm text-ink-subtle">{scoredCount}/{totalSkills} compétences notées</span>
              </div>
            </div>
          </div>
          <SaveIndicator state={saveState} validated={validated} editing={editing} validatedAt={evaluation?.validatedAt ?? null} />
        </div>

        {current.attendance && !ATTENDED.includes(current.attendance) ? (
          <Notice variant="warning" title="Participant noté absent">Une évaluation ne devrait porter que sur des comportements observés pendant la session.</Notice>
        ) : null}
        {sessionStatus === 'planned' ? <Notice title="Session pas encore démarrée">Vous pouvez préparer les évaluations ; elles se valident normalement à la fin de la session.</Notice> : null}
        {otherVersion ? <Notice title="Évaluation réalisée avec une version antérieure du référentiel">Seules les compétences de cette version sont affichées.</Notice> : null}
        {validated && !editing && canWrite ? (
          <Notice
            title="Cette évaluation est validée"
            action={
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Modifier
              </Button>
            }
          >
            Toute modification sera tracée avec son motif, l’auteur, la date, l’ancienne et la nouvelle valeur.
          </Notice>
        ) : null}

        {usableFrameworks.map((framework) => (
          <FrameworkSection
            key={framework.versionId}
            framework={framework}
            form={form}
            locked={locked}
            onScore={setScore}
            onSkillComment={setSkillComment}
            onCriterion={setCriterion}
          />
        ))}

        <section className="rounded-lg border border-line bg-white p-5" aria-labelledby="commentaires-titre">
          <h3 id="commentaires-titre" className="text-title">Observations</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="Observation générale" hint="Visible par le participant et son organisme.">
              {({ id, describedBy }) => (
                <Textarea id={id} aria-describedby={describedBy} value={form.comments.observation} onChange={(event) => setComment('observation', event.target.value)} disabled={locked} rows={4} maxLength={4000} placeholder="Ce que vous avez observé pendant la session…" />
              )}
            </Field>
            <Field label="Conseil de développement" hint="Visible par le participant et son organisme.">
              {({ id, describedBy }) => (
                <Textarea id={id} aria-describedby={describedBy} value={form.comments.advice} onChange={(event) => setComment('advice', event.target.value)} disabled={locked} rows={4} maxLength={4000} placeholder="Une piste concrète pour progresser…" />
              )}
            </Field>
          </div>
          <Field label="Note privée" hint="Réservée à l’équipe HAPPI, jamais visible du participant ni de l’organisme." className="mt-4">
            {({ id, describedBy }) => (
              <Textarea id={id} aria-describedby={describedBy} value={form.comments.private} onChange={(event) => setComment('private', event.target.value)} disabled={locked} rows={2} maxLength={4000} />
            )}
          </Field>
        </section>

        {validated && evaluation.history.length > 0 ? <HistoryPanel history={evaluation.history} /> : null}

        {/* Barre d'actions */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur-md sm:bottom-0 lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="hidden items-center gap-1.5 text-xs text-ink-subtle md:flex">
              <Keyboard className="size-4" aria-hidden />
              Alt + ← / → pour changer de participant · chiffres pour noter la compétence sélectionnée
            </p>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => void next()}>
                Suivant
                <ArrowRight aria-hidden />
              </Button>
              {canWrite && !validated ? (
                <Button onClick={validate} loading={validating} disabled={scoredCount === 0}>
                  <Check aria-hidden />
                  Valider l’évaluation
                </Button>
              ) : null}
              {validated && editing ? (
                <>
                  <Button variant="outline" onClick={cancelEdit}>
                    <X aria-hidden />
                    Annuler
                  </Button>
                  <Button onClick={() => setAmendOpen(true)}>Enregistrer la modification</Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </motion.section>

      <Dialog open={amendOpen} onOpenChange={setAmendOpen}>
        <DialogContent title="Motif de la modification" description="Ce motif est conservé dans l’historique de l’évaluation, avec les anciennes et les nouvelles valeurs.">
          <Field label="Motif" required>
            {({ id }) => <Textarea id={id} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder="Ex. Correction après relecture des notes de séance." />}
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAmendOpen(false)}>Annuler</Button>
            <Button onClick={submitAmendment} loading={validating} disabled={reason.trim().length < 5}>
              Confirmer la modification
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaveIndicator({ state, validated, editing, validatedAt }: { state: { status: string; at?: string; message?: string }; validated: boolean; editing: boolean; validatedAt: string | null }) {
  if (validated && !editing) return <span className="text-sm text-ink-muted">Validée le {formatDateTime(validatedAt)}</span>;
  if (validated && editing) return <span className="text-sm font-medium text-warning">Modification en cours, non enregistrée</span>;
  const content = {
    idle: null,
    dirty: <><LoaderCircle className="size-4 text-ink-subtle" aria-hidden />Modifications en attente</>,
    saving: <><LoaderCircle className="size-4 animate-spin" aria-hidden />Enregistrement du brouillon…</>,
    saved: <><CloudCheck className="size-4 text-success" aria-hidden />Brouillon enregistré</>,
    error: <><TriangleAlert className="size-4 text-danger" aria-hidden />{state.message ?? 'Brouillon non enregistré'}</>,
  }[state.status as 'idle' | 'dirty' | 'saving' | 'saved' | 'error'];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted" aria-live="polite">
      {content}
    </span>
  );
}

function FrameworkSection({
  framework,
  form,
  locked,
  onScore,
  onSkillComment,
  onCriterion,
}: {
  framework: EngineFramework;
  form: FormState;
  locked: boolean;
  onScore: (skillId: string, score: number | null) => void;
  onSkillComment: (skillId: string, comment: string) => void;
  onCriterion: (criterionId: string, value: { observed: boolean | null; score: number | null }) => void;
}) {
  const values = scaleValues(framework.rules);
  const derived = framework.rules.scoringMode !== 'direct';
  return (
    <section className="rounded-lg border border-line bg-white" aria-labelledby={`fw-${framework.code}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 id={`fw-${framework.code}`} className="flex flex-wrap items-center gap-2 text-title">
            {framework.name}
            {framework.isProvisional ? <ProvisionalBadge /> : null}
          </h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            Échelle {framework.rules.scaleMin}–{framework.rules.scaleMax} · {SCORING_MODE_LABELS[framework.rules.scoringMode].label}
            {!framework.mappingDefined ? ' · aucune correspondance définie pour cette session : toutes les compétences sont proposées' : ''}
          </p>
        </div>
        <InfoHint label={`Niveaux du référentiel ${framework.name}`}>
          <ol className="space-y-1">
            {framework.levels.map((level) => (
              <li key={level.value}>
                <span className="font-semibold text-ink">{level.value}</span> · {level.label}
              </li>
            ))}
          </ol>
          <p className="mt-2 border-t border-line pt-2 text-xs">{SCORING_MODE_LABELS[framework.rules.scoringMode].description}</p>
        </InfoHint>
      </header>
      <ul className="divide-y divide-line">
        {framework.skills.map((skill, skillIndex) => {
          const entry = form.scores[skill.id];
          const criteriaValues = skill.criteria.map((criterion) => ({ weight: criterion.weight, observed: form.criteria[criterion.id]?.observed ?? null, score: form.criteria[criterion.id]?.score ?? null }));
          const score = derived ? deriveSkillScore(framework.rules, criteriaValues) : (entry?.score ?? null);
          const showCategory = skill.category && skill.category !== framework.skills[skillIndex - 1]?.category;
          return (
            <li key={skill.id}>
              {showCategory ? <p className="bg-paper/70 px-5 py-1.5 text-xs font-semibold text-ink-muted">{skill.category}</p> : null}
              <SkillRow
                skill={skill}
                framework={framework}
                values={values}
                score={score}
                comment={entry?.comment ?? ''}
                derived={derived}
                locked={locked}
                criteria={form.criteria}
                onScore={(value) => onScore(skill.id, value)}
                onComment={(value) => onSkillComment(skill.id, value)}
                onCriterion={onCriterion}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SkillRow({
  skill,
  framework,
  values,
  score,
  comment,
  derived,
  locked,
  criteria,
  onScore,
  onComment,
  onCriterion,
}: {
  skill: EngineSkill;
  framework: EngineFramework;
  values: number[];
  score: number | null;
  comment: string;
  derived: boolean;
  locked: boolean;
  criteria: FormState['criteria'];
  onScore: (value: number | null) => void;
  onComment: (value: string) => void;
  onCriterion: (criterionId: string, value: { observed: boolean | null; score: number | null }) => void;
}) {
  const [showComment, setShowComment] = useState(Boolean(comment));
  const [showCriteria, setShowCriteria] = useState(derived);
  const descriptor = score !== null ? skill.descriptors[Math.floor(score)] : null;
  const levelLabel = (value: number) => framework.levels.find((level) => level.value === Math.floor(value))?.label ?? '';

  return (
    <div
      className="px-5 py-4 focus-within:bg-petrol-50/40"
      onKeyDown={(event) => {
        if (locked || derived || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target as HTMLElement;
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;
        const value = Number(event.key);
        if (values.includes(value)) {
          event.preventDefault();
          onScore(value);
        } else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
          onScore(null);
        }
      }}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            {skill.name}
            {skill.description ? (
              <InfoHint label={`Définition de ${skill.name}`}>
                <p className="text-ink">{skill.description}</p>
              </InfoHint>
            ) : null}
          </p>
          <p className="text-sm text-ink-muted">{score !== null ? `${formatScore(score)} · ${levelLabel(score)}` : 'Non observée'}</p>
        </div>
        <div role="radiogroup" aria-label={`Niveau observé pour ${skill.name}`} className="flex flex-wrap gap-1.5">
          {values.map((value) => {
            const selected = score !== null && Math.abs(score - value) < 1e-9;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={locked || derived}
                onClick={() => onScore(selected ? null : value)}
                title={`${value} · ${levelLabel(value)}${skill.descriptors[value] ? ` — ${skill.descriptors[value]}` : ''}`}
                className={cn(
                  'flex h-11 min-w-11 flex-col items-center justify-center rounded-md border px-2 transition-[background-color,border-color,transform] active:scale-95 sm:min-w-[4.25rem]',
                  selected ? 'border-petrol-900 bg-petrol-900 text-white' : 'border-line-strong bg-white text-ink hover:border-petrol-400',
                  (locked || derived) && !selected && 'opacity-60',
                  (locked || derived) && 'cursor-default active:scale-100',
                )}
              >
                <span className="font-display text-base leading-none font-semibold">{formatScore(value)}</span>
                <span className={cn('mt-0.5 hidden max-w-[4.5rem] truncate text-[0.625rem] leading-none sm:block', selected ? 'text-white/75' : 'text-ink-subtle')}>{levelLabel(value)}</span>
              </button>
            );
          })}
        </div>
      </div>
      {descriptor ? <p className="mt-2 text-sm text-ink-muted">{descriptor}</p> : null}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {!locked || comment ? (
          <button type="button" onClick={() => setShowComment((value) => !value)} className="inline-flex items-center gap-1 text-sm font-medium text-petrol-700 hover:text-petrol-950">
            <MessageSquarePlus className="size-4" aria-hidden />
            {comment ? 'Commentaire' : 'Ajouter un commentaire'}
          </button>
        ) : null}
        {skill.criteria.length > 0 ? (
          <button type="button" onClick={() => setShowCriteria((value) => !value)} className="text-sm font-medium text-petrol-700 hover:text-petrol-950" aria-expanded={showCriteria}>
            {derived ? 'Critères' : 'Repères d’observation'} ({skill.criteria.length})
          </button>
        ) : null}
      </div>
      {showComment ? (
        <Textarea className="mt-2" rows={2} maxLength={1500} value={comment} disabled={locked} onChange={(event) => onComment(event.target.value)} aria-label={`Commentaire sur ${skill.name}`} />
      ) : null}
      {showCriteria && skill.criteria.length > 0 ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {skill.criteria.map((criterion) => {
            const value = criteria[criterion.id];
            if (framework.rules.scoringMode === 'criteria_average') {
              return (
                <li key={criterion.id} className="flex items-center justify-between gap-3 rounded-md bg-paper px-3 py-2 text-sm">
                  <span>{criterion.label}</span>
                  <select
                    aria-label={`Note du critère ${criterion.label}`}
                    disabled={locked}
                    value={value?.score ?? ''}
                    onChange={(event) => onCriterion(criterion.id, { observed: null, score: event.target.value === '' ? null : Number(event.target.value) })}
                    className="h-8 rounded-sm border border-line-strong bg-white px-2"
                  >
                    <option value="">—</option>
                    {values.map((v) => <option key={v} value={v}>{formatScore(v)}</option>)}
                  </select>
                </li>
              );
            }
            if (framework.rules.scoringMode === 'criteria_count') {
              return (
                <li key={criterion.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md bg-paper px-3 py-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[#102c32]" disabled={locked} checked={value?.observed === true} onChange={(event) => onCriterion(criterion.id, { observed: event.target.checked, score: null })} />
                    {criterion.label}
                  </label>
                </li>
              );
            }
            return (
              <li key={criterion.id} className="flex gap-2 rounded-md bg-paper px-3 py-2 text-sm text-ink-muted">
                <span className="mt-2 h-1 w-2 shrink-0 rounded-full bg-petrol-400" aria-hidden />
                {criterion.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function HistoryPanel({ history }: { history: HistoryEntry[] }) {
  const labels: Record<string, string> = { validated: 'Validation', score: 'Note', score_comment: 'Commentaire de compétence', criterion: 'Critère', comment: 'Commentaire' };
  return (
    <section className="rounded-lg border border-line bg-white p-5" aria-labelledby="historique-titre">
      <h3 id="historique-titre" className="flex items-center gap-2 text-title">
        <History className="size-5 text-petrol-500" aria-hidden />
        Historique
      </h3>
      <ol className="mt-4 space-y-3">
        {history.map((entry) => (
          <li key={entry.id} className="border-l-2 border-line pl-3 text-sm">
            <p className="text-ink">
              <span className="font-semibold">{labels[entry.type] ?? entry.type}</span>
              {entry.subject ? ` · ${entry.subject}` : ''}
              {entry.type !== 'validated' ? (
                <span className="text-ink-muted">
                  {' '}: {entry.oldValue ?? 'vide'} → {entry.newValue ?? 'vide'}
                </span>
              ) : null}
            </p>
            <p className="text-ink-subtle">
              {formatDateTime(entry.at)}
              {entry.author ? ` · ${entry.author}` : ''}
              {entry.reason ? ` · motif : ${entry.reason}` : ''}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
