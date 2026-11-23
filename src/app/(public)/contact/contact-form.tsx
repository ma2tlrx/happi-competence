'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';

import { sendContactMessage } from './actions';

export function ContactForm() {
  const [state, action] = useActionState(sendContactMessage, null);
  const errors = state?.fieldErrors ?? {};

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-line bg-white p-6 sm:p-8">
        <FormMessage state={state} />
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5 rounded-xl border border-line bg-white p-6 sm:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nom" required error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} name="name" autoComplete="name" required aria-describedby={describedBy} aria-invalid={invalid || undefined} />
          )}
        </Field>
        <Field label="Adresse e-mail" required error={errors.email}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} name="email" type="email" autoComplete="email" required aria-describedby={describedBy} aria-invalid={invalid || undefined} />
          )}
        </Field>
      </div>
      <Field label="Votre demande concerne" required error={errors.program}>
        {({ id, describedBy, invalid }) => (
          <Select id={id} name="program" defaultValue="" required aria-describedby={describedBy} aria-invalid={invalid || undefined}>
            <option value="">Choisir un programme</option>
            <option value="happi_competence">Le programme HAPPI Compétence</option>
            <option value="passeport_numerique">Le Passeport Numérique</option>
            <option value="les_deux">Les deux programmes</option>
            <option value="autre">Autre question</option>
          </Select>
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Votre organisme" optional hint="Association, mission locale, entreprise…" error={errors.organization}>
          {({ id, describedBy }) => <Input id={id} name="organization" autoComplete="organization" aria-describedby={describedBy} />}
        </Field>
        <Field label="Vous êtes" optional>
          {({ id }) => (
            <Select id={id} name="audience" defaultValue="">
              <option value="">Sélectionner</option>
              <option value="participant">Un participant ou futur participant</option>
              <option value="organisme">Un organisme d’accompagnement</option>
              <option value="entreprise">Une entreprise</option>
              <option value="autre">Autre</option>
            </Select>
          )}
        </Field>
      </div>
      <Field label="Objet" required hint="Pourquoi nous contactez-vous ? Par exemple : inscrire un groupe, avoir des informations, devenir partenaire." error={errors.subject}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="subject" maxLength={160} required aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>
      <Field label="Message" required error={errors.message}>
        {({ id, describedBy, invalid }) => (
          <Textarea id={id} name="message" rows={6} required maxLength={4000} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>
      {/* Champ piège pour les robots, invisible pour les personnes et les lecteurs d'écran */}
      <div className="hidden" aria-hidden>
        <label>
          Site web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Checkbox
        name="consent"
        error={errors.consent}
        label={
          <>
            J’accepte que HAPPI utilise ces informations pour répondre à ma demande.{' '}
            <Link href="/confidentialite" className="font-medium text-petrol-700 underline underline-offset-2">
              En savoir plus
            </Link>
          </>
        }
      />
      <FormMessage state={state} />
      <SubmitButton size="lg">Envoyer le message</SubmitButton>
    </form>
  );
}
