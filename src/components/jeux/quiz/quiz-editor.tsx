'use client';

import { ArrowLeft, Check, CircleAlert, Copy, Plus, Save, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Badge, Card, CardBody, Notice, PageHeader, Skeleton } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { getQuiz, type Quiz, type QuizAnswer, type QuizQuestion, type QuestionType, saveQuiz } from '@/lib/jeux/client-quiz';
import { cn } from '@/lib/utils';

import { answerStyle } from './answer-style';
import { ConfirmDialog } from './confirm-dialog';

const TYPES: { value: QuestionType; label: string; hint: string }[] = [
  { value: 'multiple_choice', label: 'Choix unique', hint: 'Une seule bonne réponse : choisissez-la avec le bouton « Bonne réponse ».' },
  { value: 'true_false', label: 'Vrai ou faux', hint: 'Deux réponses fixes : indiquez laquelle est correcte.' },
  { value: 'multiple_select', label: 'Choix multiples', hint: 'Plusieurs bonnes réponses possibles : cochez-les toutes.' },
];
const TIME_LIMITS = [10, 20, 30, 45, 60];
const MAX_ANSWERS = 6;

/** Identifiant aléatoire, y compris hors contexte sécurisé (test sur le réseau local en http). */
function uid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const blankAnswers = (n = 4): QuizAnswer[] => Array.from({ length: n }, () => ({ id: uid(), text: '', isCorrect: false }));

function emptyQuestion(order: number): QuizQuestion {
  return { id: uid(), text: '', type: 'multiple_choice', timeLimit: 20, order, imageUrl: '', answers: blankAnswers() };
}

/** Une question est prête à être jouée : énoncé, au moins deux réponses remplies dont une correcte. */
function questionProblem(q: QuizQuestion): string | null {
  if (!q.text.trim()) return 'Énoncé manquant';
  if (q.answers.filter((a) => a.text.trim()).length < 2) return 'Au moins deux réponses';
  if (!q.answers.some((a) => a.isCorrect && a.text.trim())) return 'Bonne réponse à choisir';
  return null;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function QuizEditor({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [revision, setRevision] = useState(0);
  const [toRemove, setToRemove] = useState<number | null>(null);
  const latest = useRef({ quiz, questions });
  useEffect(() => {
    latest.current = { quiz, questions };
  });

  useEffect(() => {
    let cancelled = false;
    getQuiz(quizId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(res.error);
      } else {
        setQuiz(res.data.quiz);
        setQuestions(res.data.questions.length > 0 ? res.data.questions : [emptyQuestion(0)]);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  const save = useCallback(
    async (auto: boolean) => {
      const { quiz: q, questions: qs } = latest.current;
      if (!q) return;
      setSaveState('saving');
      const res = await saveQuiz(quizId, { quiz: { title: q.title, description: q.description, themeColor: q.themeColor }, questions: qs });
      if (!res.ok) {
        setSaveState('error');
        toast.error(auto ? `Enregistrement automatique impossible : ${res.error}` : res.error);
        return;
      }
      setSaveState('saved');
      if (!auto) toast.success('Quiz enregistré.');
    },
    [quizId],
  );

  // Enregistrement automatique 1,5 s après la dernière modification.
  useEffect(() => {
    if (revision === 0) return;
    const t = setTimeout(() => void save(true), 1500);
    return () => clearTimeout(t);
  }, [revision, save]);

  /** Toute modification passe par ici : elle déclenche l'enregistrement automatique. */
  function edit(fn: (prev: QuizQuestion[]) => QuizQuestion[]) {
    setQuestions(fn);
    setSaveState('idle');
    setRevision((r) => r + 1);
  }
  function editQuiz(patch: Partial<Quiz>) {
    setQuiz((q) => (q ? { ...q, ...patch } : q));
    setSaveState('idle');
    setRevision((r) => r + 1);
  }
  const patchQuestion = (idx: number, patch: Partial<QuizQuestion>) => edit((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  const patchAnswer = (qIdx: number, aIdx: number, patch: Partial<QuizAnswer>) =>
    edit((prev) => prev.map((q, i) => (i !== qIdx ? q : { ...q, answers: q.answers.map((a, j) => (j === aIdx ? { ...a, ...patch } : a)) })));

  function toggleCorrect(qIdx: number, aIdx: number) {
    edit((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const multiple = q.type === 'multiple_select';
        return { ...q, answers: q.answers.map((a, j) => (j === aIdx ? { ...a, isCorrect: multiple ? !a.isCorrect : true } : multiple ? a : { ...a, isCorrect: false })) };
      }),
    );
  }

  function changeType(idx: number, type: QuestionType) {
    edit((prev) =>
      prev.map((q, i) => {
        if (i !== idx || q.type === type) return q;
        if (type === 'true_false') {
          return { ...q, type, answers: [{ id: uid(), text: 'Vrai', isCorrect: true }, { id: uid(), text: 'Faux', isCorrect: false }] };
        }
        if (q.type === 'true_false') return { ...q, type, answers: blankAnswers() };
        if (type === 'multiple_choice') {
          // Une seule bonne réponse : on garde la première.
          let seen = false;
          return { ...q, type, answers: q.answers.map((a) => (a.isCorrect && !seen ? ((seen = true), a) : { ...a, isCorrect: false })) };
        }
        return { ...q, type };
      }),
    );
  }

  function addQuestion() {
    edit((prev) => [...prev, emptyQuestion(prev.length)]);
    setActive(questions.length);
  }

  function duplicateQuestion(idx: number) {
    edit((prev) => {
      const src = prev[idx];
      const copy: QuizQuestion = { ...src, id: uid(), answers: src.answers.map((a) => ({ ...a, id: uid() })) };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)].map((q, i) => ({ ...q, order: i }));
    });
    setActive(idx + 1);
  }

  function removeQuestion(idx: number) {
    if (questions.length <= 1) return;
    edit((prev) => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order: i })));
    setActive(Math.min(idx, questions.length - 2));
    setToRemove(null);
  }

  function addAnswer(idx: number) {
    edit((prev) => prev.map((q, i) => (i === idx && q.answers.length < MAX_ANSWERS ? { ...q, answers: [...q.answers, ...blankAnswers(1)] } : q)));
  }
  function removeAnswer(qIdx: number, aIdx: number) {
    edit((prev) => prev.map((q, i) => (i === qIdx && q.answers.length > 2 ? { ...q, answers: q.answers.filter((_, j) => j !== aIdx) } : q)));
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (loadError || !quiz) {
    return (
      <>
        <Notice variant="danger" title="Quiz introuvable">
          {loadError ?? 'Ce quiz n’existe pas ou ne vous appartient pas.'}
        </Notice>
        <Button className="mt-4" variant="outline" onClick={() => router.push('/jeux/quiz')}>
          <ArrowLeft aria-hidden />
          Retour à la bibliothèque
        </Button>
      </>
    );
  }

  const q = questions[active] ?? questions[0];
  const qIdx = questions.indexOf(q);
  const incomplete = questions.filter((x) => questionProblem(x)).length;
  const typeInfo = TYPES.find((t) => t.value === q.type)!;

  return (
    <>
      <PageHeader
        back={
          <Link href="/jeux/quiz" className="inline-flex items-center gap-1.5 font-medium text-petrol-700 hover:text-petrol-950">
            <ArrowLeft className="size-4" aria-hidden />
            Bibliothèque de quiz
          </Link>
        }
        title="Éditeur de quiz"
        description={`${questions.length} question${questions.length > 1 ? 's' : ''}${incomplete > 0 ? ` · ${incomplete} à compléter` : ' · prêt à jouer'}`}
        actions={
          <>
            <span className="min-h-6 text-sm" role="status" aria-live="polite">
              {saveState === 'saving' ? <span className="text-ink-muted">Enregistrement…</span> : null}
              {saveState === 'saved' ? (
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <Check className="size-4" aria-hidden /> Enregistré
                </span>
              ) : null}
              {saveState === 'error' ? (
                <span className="inline-flex items-center gap-1 font-medium text-danger">
                  <CircleAlert className="size-4" aria-hidden /> Non enregistré
                </span>
              ) : null}
            </span>
            <Button onClick={() => save(false)} loading={saveState === 'saving'}>
              <Save aria-hidden />
              Enregistrer
            </Button>
          </>
        }
      />

      <Card className="mb-5">
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Titre du quiz" required>
            {({ id }) => <Input id={id} value={quiz.title} maxLength={120} onChange={(e) => editQuiz({ title: e.target.value })} />}
          </Field>
          <Field label="Description" optional>
            {({ id }) => <Input id={id} value={quiz.description} maxLength={500} onChange={(e) => editQuiz({ description: e.target.value })} />}
          </Field>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
        {/* Liste des questions */}
        <nav aria-label="Questions du quiz" className="min-w-0">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {questions.map((item, i) => {
              const problem = questionProblem(item);
              return (
                <li key={item.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-current={i === qIdx ? 'step' : undefined}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      i === qIdx ? 'border-orange-500 bg-orange-50' : 'border-line bg-white hover:border-petrol-400',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full font-display text-xs font-semibold',
                        i === qIdx ? 'bg-orange-500 text-petrol-950' : 'bg-paper text-ink-muted',
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="hidden min-w-0 flex-1 truncate lg:block">{item.text || <span className="text-ink-subtle italic">Sans énoncé</span>}</span>
                    <span className="sr-only">{problem ? `, à compléter : ${problem}` : ', complète'}</span>
                    {problem ? <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden /> : <Check className="size-4 shrink-0 text-success" aria-hidden />}
                  </button>
                </li>
              );
            })}
            <li className="shrink-0 lg:shrink">
              <Button variant="outline" className="w-full" onClick={addQuestion}>
                <Plus aria-hidden />
                Question
              </Button>
            </li>
          </ul>
        </nav>

        {/* Question active */}
        <div className="min-w-0 space-y-5">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Question {qIdx + 1}</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => duplicateQuestion(qIdx)}>
                    <Copy aria-hidden />
                    Dupliquer
                  </Button>
                  <Button variant="danger-outline" size="sm" onClick={() => setToRemove(qIdx)} disabled={questions.length <= 1}>
                    <Trash2 aria-hidden />
                    Supprimer
                  </Button>
                </div>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-sm font-semibold">Type de question</legend>
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((t) => (
                    <Button key={t.value} variant={q.type === t.value ? 'secondary' : 'outline'} size="sm" aria-pressed={q.type === t.value} onClick={() => changeType(qIdx, t.value)}>
                      {t.label}
                    </Button>
                  ))}
                </div>
                <p className="mt-1.5 text-sm text-ink-subtle">{typeInfo.hint}</p>
              </fieldset>

              <Field label="Énoncé" required>
                {({ id }) => (
                  <Textarea id={id} rows={3} value={q.text} maxLength={300} placeholder="Tapez votre question ici…" onChange={(e) => patchQuestion(qIdx, { text: e.target.value })} />
                )}
              </Field>
              <Field label="Adresse d’une image" optional hint="Lien direct vers une image, affiché avec la question.">
                {({ id, describedBy }) => (
                  <Input id={id} aria-describedby={describedBy} type="url" inputMode="url" value={q.imageUrl ?? ''} placeholder="https://…" onChange={(e) => patchQuestion(qIdx, { imageUrl: e.target.value })} />
                )}
              </Field>

              <fieldset>
                <legend className="mb-1.5 text-sm font-semibold">Temps de réponse</legend>
                <div className="flex flex-wrap gap-2">
                  {TIME_LIMITS.map((t) => (
                    <Button key={t} variant={q.timeLimit === t ? 'secondary' : 'outline'} size="sm" aria-pressed={q.timeLimit === t} onClick={() => patchQuestion(qIdx, { timeLimit: t })}>
                      {t} s
                    </Button>
                  ))}
                </div>
              </fieldset>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Réponses</h3>
                {questionProblem(q) ? (
                  <Badge variant="warning" icon={CircleAlert}>
                    {questionProblem(q)}
                  </Badge>
                ) : (
                  <Badge variant="success" icon={Check}>
                    Complète
                  </Badge>
                )}
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {q.answers.map((a, aIdx) => {
                  const style = answerStyle(aIdx);
                  const Icon = style.icon;
                  const fixed = q.type === 'true_false';
                  return (
                    <li key={a.id} className={cn('rounded-lg border-2 p-3 transition-colors', a.isCorrect ? 'border-success bg-success-soft' : 'border-line bg-white')}>
                      <div className="flex items-center gap-2">
                        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', style.bg, style.text)} aria-hidden>
                          <Icon className="size-4" />
                        </span>
                        <Input
                          aria-label={`Réponse ${style.letter}`}
                          value={a.text}
                          readOnly={fixed}
                          maxLength={120}
                          placeholder={`Réponse ${style.letter}`}
                          onChange={(e) => patchAnswer(qIdx, aIdx, { text: e.target.value })}
                          className={cn('min-w-0 flex-1', fixed && 'bg-paper font-semibold')}
                        />
                        {!fixed && q.answers.length > 2 ? (
                          <Button variant="ghost" size="icon-sm" onClick={() => removeAnswer(qIdx, aIdx)} aria-label={`Retirer la réponse ${style.letter}`}>
                            <X aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                      <Button
                        variant={a.isCorrect ? 'secondary' : 'outline'}
                        size="sm"
                        className="mt-2.5 w-full"
                        aria-pressed={a.isCorrect}
                        onClick={() => toggleCorrect(qIdx, aIdx)}
                      >
                        <Check aria-hidden />
                        {a.isCorrect ? 'Bonne réponse' : 'Marquer comme bonne réponse'}
                        <span className="sr-only"> : réponse {style.letter}</span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {q.type !== 'true_false' && q.answers.length < MAX_ANSWERS ? (
                <Button variant="ghost" size="sm" onClick={() => addAnswer(qIdx)}>
                  <Plus aria-hidden />
                  Ajouter une réponse
                </Button>
              ) : null}
            </CardBody>
          </Card>

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setActive(Math.max(0, qIdx - 1))} disabled={qIdx === 0}>
              Précédente
            </Button>
            {qIdx < questions.length - 1 ? (
              <Button variant="outline" onClick={() => setActive(qIdx + 1)}>
                Suivante
              </Button>
            ) : (
              <Button onClick={addQuestion}>
                <Plus aria-hidden />
                Ajouter une question
              </Button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(o) => !o && setToRemove(null)}
        title="Supprimer cette question ?"
        description={toRemove !== null ? `La question ${toRemove + 1} sera retirée du quiz.` : undefined}
        confirmLabel="Supprimer"
        onConfirm={() => toRemove !== null && removeQuestion(toRemove)}
      />
    </>
  );
}
