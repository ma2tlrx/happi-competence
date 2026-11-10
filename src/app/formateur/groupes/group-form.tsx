'use client';

import { useActionState } from 'react';

import { Field, FormMessage, Input, Select, SubmitButton } from '@/components/ui/form';
import type { ActionState } from '@/lib/action-state';

type Option = { id: string; name: string };
export type GroupValues = { name: string; programId: string; organizationId: string | null; startDate: string | null; endDate: string | null; status?: string };

export function GroupForm({
  action,
  programs,
  organizations,
  initial,
  submitLabel,
  withStatus = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  programs: Option[];
  organizations: Option[];
  initial?: GroupValues;
  submitLabel: string;
  withStatus?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Field label="Nom du groupe" required error={errors.name}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="name" defaultValue={initial?.name} placeholder="Ex. Groupe Mission Locale — janvier" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Programme" required error={errors.programId}>
          {({ id }) => (
            <Select id={id} name="programId" defaultValue={initial?.programId ?? programs[0]?.id}>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>{program.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Organisme" optional hint="Les participants ajoutés sans rattachement rejoindront cet organisme.">
          {({ id, describedBy }) => (
            <Select id={id} name="organizationId" defaultValue={initial?.organizationId ?? ''} aria-describedby={describedBy}>
              <option value="">Aucun organisme</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Date de début" optional error={errors.startDate}>
          {({ id }) => <Input id={id} name="startDate" type="date" defaultValue={initial?.startDate ?? ''} />}
        </Field>
        <Field label="Date de fin" optional error={errors.endDate}>
          {({ id, invalid }) => <Input id={id} name="endDate" type="date" defaultValue={initial?.endDate ?? ''} aria-invalid={invalid || undefined} />}
        </Field>
      </div>
      {withStatus ? (
        <Field label="Statut">
          {({ id }) => (
            <Select id={id} name="status" defaultValue={initial?.status ?? 'active'}>
              <option value="planned">Prévu</option>
              <option value="active">En cours</option>
              <option value="completed">Terminé</option>
              <option value="archived">Archivé</option>
            </Select>
          )}
        </Field>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
