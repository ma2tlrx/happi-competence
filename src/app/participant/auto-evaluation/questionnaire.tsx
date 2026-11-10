'use client';

import { Check, CloudCheck, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';

import { FormMessage, SubmitButton, Textarea } from '@/components/ui/form';
import { cn } from '@/lib/utils';

import { completeSelfAssessment, saveAnswer } from './actions';

type Question = { id: string; position: number; text: string; help: string | null };

export function Questionnaire({
  assessmentId,
  intro,
  questions,
  scale,
  initialAnswers,
  next,
}: {
  assessmentId: string;
  intro: string | null;
  questions: Question[];
  scale: { value: number; label: string }[];
  initialAnswers: Record<string, number>;
  next: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>(initialAnswers);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, action] = useActionState(completeSelfAssessment, null);
  const answered = questions.filter((question) => answers[question.id] !== undefined).length;
  const complete = answered === questions.length;

  useEffect(() => {
    if (state?.ok) router.push(next);
  }, [state, router, next]);

  const choose = (questionId: string, value: number) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    startSaving(async () => {
      const result = await saveAnswer({ assessmentId, questionId, value });
      setError(result.ok ? null : (result.message ?? 'La réponse n’a pas été enregistrée.'));
    });
  };

  return (
    <div className="space-y-5">
      {intro ? <p className="max-w-2xl text-ink-muted">{intro}</p> : null}

      <div className="sticky top-16 z-10 -mx-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:bg-white/95 sm:px-5">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-semibold text-ink">
            {answered} / {questions.length} réponses
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink-muted" aria-live="polite">
            {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <CloudCheck className="size-4 text-success" aria-hidden />}
            {saving ? 'Enregistrement…' : 'Réponses enregistrées automatiquement'}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-petrol-100">
          <div className="h-full rounded-full bg-orange-500 transition-[width] duration-300" style={{ width: `${(answered / questions.length) * 100}%` }} />
        </div>
      </div>
      {error ? <FormMessage state={{ ok: false, message: error }} /> : null}

      <ol className="space-y-3">
        {questions.map((question, index) => (
          <li key={question.id} className="rounded-lg border border-line bg-white p-5">
            <fieldset>
              <legend className="flex gap-3 font-medium text-ink">
                <span className="text-ink-subtle tabular-nums">{index + 1}.</span>
                <span>{question.text}</span>
              </legend>
              {question.help ? <p className="mt-1 ml-7 text-sm text-ink-muted">{question.help}</p> : null}
              <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
                {scale.map((level) => {
                  const selected = answers[question.id] === level.value;
                  return (
                    <label
                      key={level.value}
                      className={cn(
                        'flex cursor-pointer flex-col items-center gap-1.5 rounded-md border px-1 py-2.5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-orange-500',
                        selected ? 'border-petrol-900 bg-petrol-900 text-white' : 'border-line-strong bg-white text-ink hover:border-petrol-400',
                      )}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={level.value}
                        checked={selected}
                        onChange={() => choose(question.id, level.value)}
                        className="sr-only"
                      />
                      <span className="flex items-center gap-1 font-display text-base font-semibold">
                        {selected ? <Check className="size-4" strokeWidth={3} aria-hidden /> : null}
                        {level.value}
                      </span>
                      <span className={cn('hidden text-xs leading-tight sm:block', selected ? 'text-white/80' : 'text-ink-muted')}>{level.label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-xs text-ink-subtle sm:hidden">
                <span>{scale[0]?.label}</span>
                <span>{scale.at(-1)?.label}</span>
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <form action={action} className="space-y-4 rounded-lg border border-line bg-white p-5">
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <label className="block">
          <span className="text-sm font-semibold text-ink">
            Un commentaire sur vos réponses ? <span className="font-normal text-ink-subtle">facultatif</span>
          </span>
          <Textarea name="comment" rows={3} maxLength={2000} className="mt-1.5" />
        </label>
        <FormMessage state={state} />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton size="lg" disabled={!complete}>
            Valider mon auto-évaluation
          </SubmitButton>
          {!complete ? <span className="text-sm text-ink-muted">Répondez à toutes les affirmations pour valider.</span> : null}
        </div>
        <p className="text-sm text-ink-subtle">Une fois validée, votre auto-évaluation ne peut plus être modifiée : elle sert de point de départ.</p>
      </form>
    </div>
  );
}
