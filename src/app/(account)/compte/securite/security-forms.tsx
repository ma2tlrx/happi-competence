'use client';

import { ShieldCheck } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormMessage, Input, SubmitButton } from '@/components/ui/form';

import { confirmMfaEnrollment, disableMfa, startMfaEnrollment, type Enrollment } from './actions';

function CodeField({ error, label = 'Code de vérification' }: { error?: string; label?: string }) {
  return (
    <Field label={label} required error={error} hint="Les 6 chiffres affichés par l’application (ils changent toutes les 30 secondes).">
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          className="max-w-48 font-mono text-lg tracking-[0.3em]"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </Field>
  );
}

/** Activation en trois étapes : application, QR code (ou clé), premier code. */
export function MfaEnrollment() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [state, action] = useActionState(confirmMfaEnrollment, null);
  const errors = state?.fieldErrors ?? {};

  if (state?.ok) return <FormMessage state={state} />;

  if (!enrollment) {
    return (
      <div className="space-y-4">
        <Button
          type="button"
          loading={pending}
          onClick={() =>
            start(async () => {
              setStartError(null);
              const result = await startMfaEnrollment();
              if (result.ok) setEnrollment(result.data);
              else setStartError(result.message);
            })
          }
        >
          <ShieldCheck aria-hidden />
          Activer la double authentification
        </Button>
        <FormMessage state={startError ? { ok: false, message: startError } : null} />
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="factorId" value={enrollment.factorId} />
      <ol className="space-y-6 text-[0.9375rem]">
        <li>
          <p className="font-semibold">1. Installez une application d’authentification</p>
          <p className="mt-1 text-ink-muted">
            Sur votre téléphone : par exemple Aegis, FreeOTP, Google Authenticator ou Microsoft Authenticator. Toute application compatible
            « TOTP » convient.
          </p>
        </li>
        <li>
          <p className="font-semibold">2. Ajoutez votre compte HAPPI</p>
          <p className="mt-1 text-ink-muted">Scannez ce QR code avec l’application.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- image SVG en URI de données, générée par Supabase */}
          <img src={enrollment.qrCode} alt="QR code à scanner avec votre application d’authentification" width={180} height={180} className="mt-3 rounded-md border border-line bg-white p-2" />
          <p className="mt-3 text-ink-muted">Impossible de scanner ? Saisissez cette clé dans l’application :</p>
          <code className="mt-1 block rounded-sm bg-paper px-3 py-2 font-mono text-sm break-all select-all">{enrollment.secret}</code>
        </li>
        <li className="space-y-3">
          <p className="font-semibold">3. Saisissez le code affiché</p>
          <CodeField error={errors.code} />
        </li>
      </ol>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton>Confirmer l’activation</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setEnrollment(null)}>Annuler</Button>
      </div>
    </form>
  );
}

export function MfaDisableForm() {
  const [state, action] = useActionState(disableMfa, null);
  const errors = state?.fieldErrors ?? {};
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <p className="text-[0.9375rem] text-ink-muted">Pour désactiver la double authentification, confirmez avec un code de votre application.</p>
      <CodeField error={errors.code} label="Code actuel" />
      <FormMessage state={state} />
      <SubmitButton variant="danger-outline">Désactiver la double authentification</SubmitButton>
    </form>
  );
}
