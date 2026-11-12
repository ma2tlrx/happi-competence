'use client';

import { ClipboardPen, Pencil } from 'lucide-react';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { ProvisionalBadge } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { saveOutcome } from '@/lib/outcomes/actions';
import { OUTCOME_DETAILS_MAX, OUTCOME_KINDS, OUTCOME_SITUATION_CODES, OUTCOME_SITUATIONS, PROVISIONAL_OUTCOMES_NOTICE, type OutcomeKind } from '@/lib/outcomes/labels';

export type OutcomeDialogProps = {
  participantId: string;
  participantName: string;
  groupId: string | null;
  groupName?: string | null;
  kind: OutcomeKind;
  existing?: { situation: string; observedOn: string; details: string | null } | null;
  size?: 'sm' | 'md';
};

/** Saisie ou correction de la situation d'un participant (entrée, sortie, suivi à 3 ou 6 mois). */
export function OutcomeDialog({ participantId, participantName, groupId, groupName, kind, existing, size = 'sm' }: OutcomeDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (previous: Awaited<ReturnType<typeof saveOutcome>>, formData: FormData) => {
    const result = await saveOutcome(previous, formData);
    if (result?.ok) {
      toast.success(result.message ?? 'Situation enregistrée.');
      setOpen(false);
    }
    return result;
  }, null);
  const today = new Date().toISOString().slice(0, 10);
  const errors = state?.fieldErrors ?? {};

  const label = existing ? 'Modifier' : 'Saisir';
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant={existing ? 'ghost' : 'outline'} aria-label={`${label} la situation (${OUTCOME_KINDS[kind].toLowerCase()}) de ${participantName}`}>
          {existing ? <Pencil aria-hidden /> : <ClipboardPen aria-hidden />}
          <span className={size === 'sm' ? 'hidden sm:inline' : undefined}>{label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`${OUTCOME_KINDS[kind]} · ${participantName}`}
        description={groupName ? `Groupe « ${groupName} ». Chaque modification est conservée dans le journal d’activité.` : 'Chaque modification est conservée dans le journal d’activité.'}
      >
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="participantId" value={participantId} />
          <input type="hidden" name="groupId" value={groupId ?? ''} />
          <input type="hidden" name="kind" value={kind} />
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <ProvisionalBadge>Catégories provisoires</ProvisionalBadge>
            <span>{PROVISIONAL_OUTCOMES_NOTICE}</span>
          </p>
          <Field label="Situation" required error={errors.situation}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} name="situation" required defaultValue={existing?.situation ?? ''} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
                <option value="" disabled>
                  Sélectionner
                </option>
                {OUTCOME_SITUATION_CODES.map((code) => (
                  <option key={code} value={code}>
                    {OUTCOME_SITUATIONS[code].label}
                    {OUTCOME_SITUATIONS[code].hint ? ` (${OUTCOME_SITUATIONS[code].hint})` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Date de l’observation" required error={errors.observedOn} hint="Date à laquelle la situation a été constatée.">
            {({ id, describedBy, invalid }) => (
              <Input id={id} name="observedOn" type="date" max={today} defaultValue={existing?.observedOn ?? today} required aria-describedby={describedBy} aria-invalid={invalid || undefined} />
            )}
          </Field>
          <Field label="Précisions" optional error={errors.details} hint={`Employeur, intitulé de la formation, démarche en cours… ${OUTCOME_DETAILS_MAX} caractères au plus.`}>
            {({ id, describedBy, invalid }) => (
              <Textarea id={id} name="details" rows={3} maxLength={OUTCOME_DETAILS_MAX} defaultValue={existing?.details ?? ''} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
            )}
          </Field>
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <SubmitButton>Enregistrer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
