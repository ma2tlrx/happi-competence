'use client';

import { UserCheck } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { toast } from '@/components/ui/toast';
import { assignReferral, assignReferralToGroup, updateGroupCapacity, updateReferralStatus } from '@/app/formateur/orientations/actions';
import { STATUS_REASON_MAX } from '@/lib/referrals/fields';
import { REFERRAL_STATUS, type ReferralStatus } from '@/lib/referrals/status';

export function StatusForm({ referralId, targets }: { referralId: string; targets: ReferralStatus[] }) {
  const choices = targets.filter((target) => target !== 'accepted');
  const [status, setStatus] = useState<string>(choices[0] ?? '');
  const [state, action] = useActionState(updateReferralStatus.bind(null, referralId), null);
  const errors = state?.fieldErrors ?? {};
  if (choices.length === 0) return null;
  return (
    <form action={action} className="space-y-4">
      <Field label="Nouveau statut">
        {({ id }) => (
          <Select id={id} name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
            {choices.map((target) => (
              <option key={target} value={target}>
                {REFERRAL_STATUS[target].label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {status === 'interview_scheduled' ? (
        <Field label="Date et heure de l’entretien" optional error={errors.interviewAt} hint="Heure de Paris.">
          {({ id, describedBy, invalid }) => <Input id={id} name="interviewAt" type="datetime-local" aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
        </Field>
      ) : null}
      {status === 'refused' ? (
        <Field label="Motif du refus" required error={errors.reason} hint="Visible par le prescripteur. Restez factuel, sans information de santé.">
          {({ id, describedBy, invalid }) => <Textarea id={id} name="reason" rows={3} maxLength={STATUS_REASON_MAX} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
        </Field>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Enregistrer le statut</SubmitButton>
    </form>
  );
}

export type GroupChoice = { id: string; label: string; disabled: boolean };

export function AssignForm({ referralId, groups }: { referralId: string; groups: GroupChoice[] }) {
  const [state, action] = useActionState(assignReferral.bind(null, referralId), null);
  if (groups.length === 0) return <p className="text-sm text-ink-muted">Aucun groupe ouvert dont vous êtes formateur. Un administrateur peut affecter la personne.</p>;
  return (
    <form action={action} className="space-y-4">
      <Field label="Groupe" error={state?.fieldErrors?.groupId} hint="Crée ou rattache la fiche participant, envoie l’invitation à créer son compte et les convocations.">
        {({ id, describedBy, invalid }) => (
          <Select id={id} name="groupId" defaultValue="" aria-describedby={describedBy} aria-invalid={invalid || undefined}>
            <option value="" disabled>
              Choisir un groupe
            </option>
            {groups.map((group) => (
              <option key={group.id} value={group.id} disabled={group.disabled}>
                {group.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <FormMessage state={state} />
      {state?.ok ? null : (
        <SubmitButton>
          <UserCheck aria-hidden />
          Affecter au groupe
        </SubmitButton>
      )}
    </form>
  );
}

export function WaitlistAssignButton({ referralId, groupId, name, disabled }: { referralId: string; groupId: string; name: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      if (!window.confirm(`Affecter ${name} à ce groupe ? La personne reçoit une invitation à créer son compte.`)) return;
      const result = await assignReferralToGroup(referralId, groupId);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  return (
    <Button size="sm" variant="outline" onClick={run} loading={pending} disabled={disabled} aria-label={`Affecter ${name} au groupe`}>
      <UserCheck aria-hidden />
      Affecter
    </Button>
  );
}

export function CapacityForm({ groupId, capacity, max }: { groupId: string; capacity: number | null; max: number }) {
  const [state, action] = useActionState(updateGroupCapacity.bind(null, groupId), null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Places proposées" optional error={state?.fieldErrors?.capacity} hint={`Vide : ${max} (taille maximale du programme).`}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="capacity" type="number" min={1} max={100} defaultValue={capacity ?? ''} className="w-28" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>
      <SubmitButton variant="outline" size="md">
        Enregistrer
      </SubmitButton>
      <div className="basis-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
