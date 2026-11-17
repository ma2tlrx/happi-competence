'use client';

import { EyeOff, Send } from 'lucide-react';
import { useActionState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormMessage, Input, SubmitButton } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { disablePublicResults, publishPublicResults } from '@/lib/quality/actions';

/** Publication (ou actualisation) des résultats sur la page publique, pour une période. */
export function PublishResultsForm({ from, to, today, enabled }: { from: string; to: string; today: string; enabled: boolean }) {
  const [state, action] = useActionState(publishPublicResults, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Début de la période" required error={errors.from}>
          {({ id, describedBy, invalid }) => <Input id={id} name="from" type="date" max={today} defaultValue={from} required aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
        </Field>
        <Field label="Fin de la période" required error={errors.to}>
          {({ id, describedBy, invalid }) => <Input id={id} name="to" type="date" max={today} defaultValue={to} required aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton>
        <Send aria-hidden />
        {enabled ? 'Recalculer et publier' : 'Activer et publier'}
      </SubmitButton>
    </form>
  );
}

export function DisableResultsButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await disablePublicResults();
          if (result.ok) toast.success('Page « Nos résultats » désactivée.');
          else toast.error(result.message ?? 'Désactivation impossible.');
        })
      }
    >
      {pending ? null : <EyeOff aria-hidden />}
      Désactiver la page publique
    </Button>
  );
}
