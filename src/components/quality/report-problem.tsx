'use client';

import { MessageSquareWarning } from 'lucide-react';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormMessage, Input, SubmitButton, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import type { ActionState } from '@/lib/action-state';
import { reportProblem } from '@/lib/quality/actions';

/** Bouton « Signaler un problème » : réclamation déposée depuis l'espace participant ou organisme. */
export function ReportProblemButton({ hint }: { hint: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await reportProblem(previous, formData);
    if (result?.ok) {
      toast.success(result.message ?? 'Signalement transmis.');
      setOpen(false);
    }
    return result;
  }, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <MessageSquareWarning aria-hidden />
          Signaler un problème
        </Button>
      </DialogTrigger>
      <DialogContent title="Signaler un problème" description={hint}>
        <form action={action} className="space-y-4" noValidate>
          <Field label="Objet" required error={errors.subject} hint="En quelques mots : de quoi s’agit-il ?">
            {({ id, describedBy, invalid }) => <Input id={id} name="subject" maxLength={200} required aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
          </Field>
          <Field
            label="Description"
            required
            error={errors.description}
            hint="Décrivez ce qui s’est passé, quand, et ce que vous attendez. N’indiquez aucune information de santé."
          >
            {({ id, describedBy, invalid }) => (
              <Textarea id={id} name="description" rows={6} maxLength={4000} required aria-describedby={describedBy} aria-invalid={invalid || undefined} />
            )}
          </Field>
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <SubmitButton>Envoyer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
