'use client';

import { useActionState } from 'react';

import { Field, FormMessage, Input, SubmitButton } from '@/components/ui/form';
import { saveTrainingThreshold } from '@/lib/quality/actions';

/** Seuil d'ancienneté des formations suivies (paramètre administrateur, à valider). */
export function ThresholdForm({ months }: { months: number }) {
  const [state, action] = useActionState(saveTrainingThreshold, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
      <Field label="Alerte si la dernière formation date de plus de (mois)" error={state?.fieldErrors?.months} className="w-full max-w-xs">
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="months" type="number" min={1} max={120} step={1} defaultValue={months} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>
      <SubmitButton variant="secondary">Enregistrer le seuil</SubmitButton>
      {state?.ok ? <FormMessage state={state} /> : null}
    </form>
  );
}
