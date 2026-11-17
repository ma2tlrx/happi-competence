'use client';

import { XCircle } from 'lucide-react';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormMessage, SubmitButton, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import type { ActionState } from '@/lib/action-state';
import { STATUS_REASON_MAX } from '@/lib/referrals/fields';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function CancelReferralDialog({ action }: { action: Action }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <XCircle aria-hidden />
          Annuler l’orientation
        </Button>
      </DialogTrigger>
      <DialogContent title="Annuler l’orientation" description="L’équipe HAPPI est prévenue. Cette action est définitive : pour orienter de nouveau la personne, envoyez une nouvelle fiche.">
        <form action={formAction} className="space-y-4">
          <Field label="Motif de l’annulation" required error={state?.fieldErrors?.reason} hint="Par exemple : la personne a trouvé un emploi. Aucune information de santé.">
            {({ id, describedBy, invalid }) => <Textarea id={id} name="reason" rows={3} maxLength={STATUS_REASON_MAX} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
          </Field>
          <FormMessage state={state} />
          {state?.ok ? null : <SubmitButton variant="danger">Confirmer l’annulation</SubmitButton>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
