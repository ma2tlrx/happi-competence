'use client';

import { useActionState } from 'react';

import { Checkbox, Field, FormMessage, Input, SubmitButton, Textarea } from '@/components/ui/form';

import { NewPasswordForm } from '@/app/(auth)/auth-forms';

import { requestDeletion, updateProfile } from './actions';

export function ProfileForm({ firstName, lastName, phone, email }: { firstName: string; lastName: string; phone: string; email: string }) {
  const [state, action] = useActionState(updateProfile, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Prénom" required error={errors.firstName}>
          {({ id, describedBy, invalid }) => <Input id={id} name="firstName" defaultValue={firstName} autoComplete="given-name" aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
        </Field>
        <Field label="Nom" required error={errors.lastName}>
          {({ id, describedBy, invalid }) => <Input id={id} name="lastName" defaultValue={lastName} autoComplete="family-name" aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Adresse e-mail" hint="Pour la modifier, contactez l’équipe HAPPI.">
          {({ id, describedBy }) => <Input id={id} value={email} disabled readOnly aria-describedby={describedBy} />}
        </Field>
        <Field label="Téléphone" optional error={errors.phone}>
          {({ id, describedBy, invalid }) => <Input id={id} name="phone" type="tel" defaultValue={phone} autoComplete="tel" aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Enregistrer</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  return <NewPasswordForm home="/compte" />;
}

export function DeletionForm() {
  const [state, action] = useActionState(requestDeletion, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4">
      <Field label="Précisions" optional>
        {({ id }) => <Textarea id={id} name="details" rows={3} maxLength={2000} />}
      </Field>
      <Checkbox name="confirm" label="Je comprends que la suppression effacera mon passeport de compétences et mon historique." />
      <FormMessage state={state} />
      <SubmitButton variant="danger-outline">Demander la suppression de mes données</SubmitButton>
    </form>
  );
}
