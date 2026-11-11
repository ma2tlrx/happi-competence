'use client';

import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';

import { Checkbox, Field, FormMessage, Input, Select, SubmitButton } from '@/components/ui/form';
import { ORGANIZATION_TYPES } from '@/lib/auth/roles';
import type { ActionState } from '@/lib/action-state';

import { redeemAccessCode, requestPasswordReset, signIn, signUpOrganization, signUpParticipant, signUpWithAccessCode, updatePassword } from './actions';

type FieldErrors = Record<string, string>;

function PasswordField({
  name,
  label,
  error,
  autoComplete,
  hint,
}: {
  name: string;
  label: string;
  error?: string;
  autoComplete: 'current-password' | 'new-password';
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} required error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <Input
            id={id}
            name={name}
            type={visible ? 'text' : 'password'}
            autoComplete={autoComplete}
            required
            className="pr-11"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-ink-subtle hover:bg-petrol-50 hover:text-ink"
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            aria-pressed={visible}
          >
            {visible ? <EyeOff className="size-[1.125rem]" aria-hidden /> : <Eye className="size-[1.125rem]" aria-hidden />}
          </button>
        </div>
      )}
    </Field>
  );
}

function TextField({
  name,
  label,
  errors,
  type = 'text',
  autoComplete,
  optional,
  hint,
  defaultValue,
  onChange,
}: {
  name: string;
  label: string;
  errors: FieldErrors;
  type?: string;
  autoComplete?: string;
  optional?: boolean;
  hint?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <Field label={label} required={!optional} optional={optional} error={errors[name]} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          required={!optional}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          defaultValue={defaultValue}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        />
      )}
    </Field>
  );
}

const PASSWORD_HINT = 'Au moins 10 caractères, dont une lettre et un chiffre.';

function Consents({ errors }: { errors: FieldErrors }) {
  return (
    <div className="space-y-3 rounded-md bg-paper p-4">
      <Checkbox
        name="terms"
        error={errors.terms}
        label={
          <>
            J’accepte les{' '}
            <Link href="/conditions-utilisation" target="_blank" className="font-medium text-petrol-700 underline underline-offset-2">
              conditions d’utilisation
            </Link>
            .
          </>
        }
      />
      <Checkbox
        name="privacy"
        error={errors.privacy}
        label="J’accepte le traitement de mes données personnelles pour le suivi de mon parcours."
        description={
          <>
            Seuls vous, vos formateurs et l’organisme qui vous accompagne y accèdent.{' '}
            <Link href="/confidentialite" target="_blank" className="font-medium text-petrol-700 underline underline-offset-2">
              Politique de confidentialité
            </Link>
          </>
        }
      />
    </div>
  );
}

function SuccessPanel({ state }: { state: ActionState }) {
  return (
    <div className="space-y-5">
      <FormMessage state={state} />
      <Link href="/connexion" className="inline-block font-semibold text-petrol-700 underline underline-offset-4">
        Aller à la page de connexion
      </Link>
    </div>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, null);
  const errors = state?.fieldErrors ?? {};
  // L'adresse saisie est conservée après une erreur (le formulaire est réinitialisé par React),
  // et le focus revient sur le premier champ à corriger, ou sur l'adresse.
  const [email, setEmail] = useState('');
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state || state.ok) return;
    const target = form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]') ?? form.current?.querySelector<HTMLInputElement>('input[name="password"]');
    target?.focus();
  }, [state]);
  return (
    <form ref={form} action={action} className="space-y-5" noValidate>
      <input type="hidden" name="suite" value={next ?? ''} />
      <TextField name="email" label="Adresse e-mail" type="email" autoComplete="email" errors={errors} defaultValue={email} onChange={setEmail} />
      <PasswordField name="password" label="Mot de passe" autoComplete="current-password" error={errors.password} />
      <div className="-mt-2 text-right">
        <Link href="/mot-de-passe-oublie" className="text-sm font-medium text-petrol-700 underline-offset-4 hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">Me connecter</SubmitButton>
    </form>
  );
}

export function ParticipantSignUpForm() {
  const [state, action] = useActionState(signUpParticipant, null);
  const errors = state?.fieldErrors ?? {};
  if (state?.ok) return <SuccessPanel state={state} />;
  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="firstName" label="Prénom" autoComplete="given-name" errors={errors} />
        <TextField name="lastName" label="Nom" autoComplete="family-name" errors={errors} />
      </div>
      <TextField
        name="email"
        label="Adresse e-mail"
        type="email"
        autoComplete="email"
        errors={errors}
        hint="Si un formateur vous a inscrit, utilisez l’adresse qu’il a enregistrée : votre compte sera relié à votre groupe."
      />
      <PasswordField name="password" label="Mot de passe" autoComplete="new-password" error={errors.password} hint={PASSWORD_HINT} />
      <PasswordField name="passwordConfirm" label="Confirmation du mot de passe" autoComplete="new-password" error={errors.passwordConfirm} />
      <Consents errors={errors} />
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">Créer mon compte</SubmitButton>
    </form>
  );
}

export function OrganizationSignUpForm() {
  const [state, action] = useActionState(signUpOrganization, null);
  const errors = state?.fieldErrors ?? {};
  if (state?.ok) return <SuccessPanel state={state} />;
  return (
    <form action={action} className="space-y-5" noValidate>
      <fieldset className="space-y-5">
        <legend className="mb-3 text-sm font-semibold text-ink-muted">Votre structure</legend>
        <TextField name="organizationName" label="Nom de la structure" autoComplete="organization" errors={errors} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Type de structure" required error={errors.organizationType}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} name="organizationType" defaultValue="" required aria-describedby={describedBy} aria-invalid={invalid || undefined}>
                <option value="" disabled>
                  Sélectionner
                </option>
                {Object.entries(ORGANIZATION_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <TextField name="organizationCity" label="Ville" autoComplete="address-level2" errors={errors} optional />
        </div>
        <TextField name="organizationSiret" label="SIRET" errors={errors} optional hint="14 chiffres. Il facilite la validation de votre demande." />
      </fieldset>
      <fieldset className="space-y-5 border-t border-line pt-5">
        <legend className="mb-3 text-sm font-semibold text-ink-muted">Votre compte</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="firstName" label="Prénom" autoComplete="given-name" errors={errors} />
          <TextField name="lastName" label="Nom" autoComplete="family-name" errors={errors} />
        </div>
        <TextField name="email" label="Adresse e-mail professionnelle" type="email" autoComplete="email" errors={errors} />
        <PasswordField name="password" label="Mot de passe" autoComplete="new-password" error={errors.password} hint={PASSWORD_HINT} />
        <PasswordField name="passwordConfirm" label="Confirmation du mot de passe" autoComplete="new-password" error={errors.passwordConfirm} />
      </fieldset>
      <Consents errors={errors} />
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">Envoyer ma demande</SubmitButton>
    </form>
  );
}

export function AccessCodeSignUpForm() {
  const [state, action] = useActionState(signUpWithAccessCode, null);
  const errors = state?.fieldErrors ?? {};
  if (state?.ok) return <SuccessPanel state={state} />;
  return (
    <form action={action} className="space-y-5" noValidate>
      <TextField name="code" label="Code d’accès" autoComplete="off" errors={errors} hint="Le code à usage unique transmis par l’administrateur HAPPI (HAPPI-XXXXX-…)." />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="firstName" label="Prénom" autoComplete="given-name" errors={errors} />
        <TextField name="lastName" label="Nom" autoComplete="family-name" errors={errors} />
      </div>
      <TextField name="email" label="Adresse e-mail" type="email" autoComplete="email" errors={errors} />
      <PasswordField name="password" label="Mot de passe" autoComplete="new-password" error={errors.password} hint={PASSWORD_HINT} />
      <PasswordField name="passwordConfirm" label="Confirmation du mot de passe" autoComplete="new-password" error={errors.passwordConfirm} />
      <Consents errors={errors} />
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">Activer mon accès</SubmitButton>
    </form>
  );
}

export function RedeemCodeForm() {
  const [state, action] = useActionState(redeemAccessCode, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <TextField name="code" label="Code d’accès" autoComplete="off" errors={errors} />
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">Activer le code</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <TextField name="email" label="Adresse e-mail" type="email" autoComplete="email" errors={errors} />
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">Recevoir un lien</SubmitButton>
    </form>
  );
}

export function NewPasswordForm({ home }: { home: string }) {
  const [state, action] = useActionState(updatePassword, null);
  const errors = state?.fieldErrors ?? {};
  if (state?.ok) {
    return (
      <div className="space-y-5">
        <FormMessage state={state} />
        <Link href={home} className="inline-block font-semibold text-petrol-700 underline underline-offset-4">
          Continuer vers mon espace
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5" noValidate>
      <PasswordField name="password" label="Nouveau mot de passe" autoComplete="new-password" error={errors.password} hint={PASSWORD_HINT} />
      <PasswordField name="passwordConfirm" label="Confirmation" autoComplete="new-password" error={errors.passwordConfirm} />
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">Enregistrer le mot de passe</SubmitButton>
    </form>
  );
}
