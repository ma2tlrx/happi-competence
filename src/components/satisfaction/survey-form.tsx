'use client';

import { Check } from 'lucide-react';
import { useActionState, useState } from 'react';

import { FormMessage, SubmitButton, Textarea } from '@/components/ui/form';
import { submitSatisfaction } from '@/lib/satisfaction/actions';
import type { SurveyForm as SurveyFormData } from '@/lib/satisfaction/load';
import { cn } from '@/lib/utils';

type Answer = number | string;

function Choice({
  name,
  value,
  selected,
  onSelect,
  children,
  className,
}: {
  name: string;
  value: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-orange-500',
        selected ? 'border-petrol-900 bg-petrol-900 text-white' : 'border-line-strong bg-white text-ink hover:border-petrol-400',
        className,
      )}
    >
      <input type="radio" name={name} value={value} checked={selected} onChange={onSelect} className="sr-only" />
      {selected ? <Check className="size-4 shrink-0" strokeWidth={3} aria-hidden /> : null}
      {children}
    </label>
  );
}

/** Formulaire d'une enquête de satisfaction. Les réponses partent en une fois, à la validation. */
export function SurveyForm({ survey, groupId, moment }: { survey: SurveyFormData; groupId: string; moment: 'hot' | 'cold' }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [state, action] = useActionState(submitSatisfaction, null);
  const set = (id: string, value: Answer) => setAnswers((current) => ({ ...current, [id]: value }));
  const missing = survey.questions.filter((question) => question.isRequired && (answers[question.id] === undefined || answers[question.id] === '')).length;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="moment" value={moment} />
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />
      <ol className="space-y-3">
        {survey.questions.map((question, index) => (
          <li key={question.id} className="rounded-lg border border-line bg-white p-5">
            <fieldset>
              <legend className="flex gap-3 font-medium text-ink">
                <span className="text-ink-subtle tabular-nums">{index + 1}.</span>
                <span>
                  {question.text}
                  {!question.isRequired ? <span className="ml-2 text-sm font-normal text-ink-subtle">facultatif</span> : null}
                </span>
              </legend>
              {question.help ? <p className="mt-1 ml-7 text-sm text-ink-muted">{question.help}</p> : null}

              {question.kind === 'rating' ? (
                <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Choice key={value} name={question.id} value={String(value)} selected={answers[question.id] === value} onSelect={() => set(question.id, value)} className="flex-col">
                      <span className="font-display text-base font-semibold">{value}</span>
                      <span className="hidden text-xs leading-tight opacity-80 sm:block">{survey.ratingLabels[value - 1]}</span>
                    </Choice>
                  ))}
                </div>
              ) : null}
              {question.kind === 'rating' ? (
                <div className="mt-2 flex justify-between text-xs text-ink-subtle sm:hidden">
                  <span>1 · {survey.ratingLabels[0]}</span>
                  <span>5 · {survey.ratingLabels[4]}</span>
                </div>
              ) : null}

              {question.kind === 'nps' ? (
                <>
                  <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-11">
                    {Array.from({ length: 11 }, (_, value) => (
                      <Choice key={value} name={question.id} value={String(value)} selected={answers[question.id] === value} onSelect={() => set(question.id, value)}>
                        <span className="font-display text-base font-semibold tabular-nums">{value}</span>
                      </Choice>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-ink-subtle">
                    <span>0 · Pas du tout probable</span>
                    <span>10 · Très probable</span>
                  </div>
                </>
              ) : null}

              {question.kind === 'choice' ? (
                <div className="mt-4 grid gap-1.5 sm:grid-cols-3 sm:gap-2">
                  {question.options.map((option) => (
                    <Choice key={option} name={question.id} value={option} selected={answers[question.id] === option} onSelect={() => set(question.id, option)}>
                      <span className="text-[0.9375rem] font-medium">{option}</span>
                    </Choice>
                  ))}
                </div>
              ) : null}

              {question.kind === 'text' ? (
                <div className="mt-3">
                  <label htmlFor={`q-${question.id}`} className="sr-only">
                    {question.text}
                  </label>
                  <Textarea
                    id={`q-${question.id}`}
                    rows={4}
                    maxLength={1000}
                    value={typeof answers[question.id] === 'string' ? (answers[question.id] as string) : ''}
                    onChange={(event) => set(question.id, event.target.value)}
                  />
                  <p className="mt-1 text-right text-xs text-ink-subtle" aria-live="polite">
                    {String(answers[question.id] ?? '').length} / 1000
                  </p>
                </div>
              ) : null}
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="space-y-3 rounded-lg border border-line bg-white p-5">
        <FormMessage state={state} />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton size="lg" disabled={missing > 0}>
            Envoyer mon avis
          </SubmitButton>
          {missing > 0 ? <span className="text-sm text-ink-muted">Encore {missing} question{missing > 1 ? 's' : ''} obligatoire{missing > 1 ? 's' : ''}.</span> : null}
        </div>
        <p className="text-sm text-ink-subtle">Une fois envoyées, vos réponses ne peuvent plus être modifiées. Une seule réponse par personne.</p>
      </div>
    </form>
  );
}
