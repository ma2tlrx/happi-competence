'use client';

import { useActionState } from 'react';

import { Checkbox, Field, FormMessage, Input, SubmitButton } from '@/components/ui/form';

import { saveSettings } from '../actions';

const LEGAL_FIELDS: [string, string][] = [
  ['legal.company_name', 'Raison sociale'],
  ['legal.legal_form', 'Forme juridique'],
  ['legal.siret', 'SIRET'],
  ['legal.address', 'Adresse du siège'],
  ['legal.publication_director', 'Directeur de la publication'],
  ['legal.host', 'Hébergeur (nom et adresse)'],
  ['legal.dpo_contact', 'Contact protection des données'],
];

export function SettingsForm({ values }: { values: Record<string, unknown> }) {
  const [state, action] = useActionState(saveSettings, null);
  const text = (key: string) => (typeof values[key] === 'string' ? (values[key] as string) : '');
  return (
    <form action={action} className="space-y-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-ink-muted">Coordonnées affichées sur le site</legend>
        <Field label="E-mail de contact">{({ id }) => <Input id={id} name="contact.email" type="email" defaultValue={text('contact.email')} />}</Field>
        <Field label="Téléphones" hint="Séparés par des virgules.">{({ id, describedBy }) => <Input id={id} name="contact.phones" aria-describedby={describedBy} defaultValue={Array.isArray(values['contact.phones']) ? (values['contact.phones'] as string[]).join(', ') : ''} />}</Field>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-ink-muted">Mentions légales</legend>
        {LEGAL_FIELDS.map(([key, label]) => (
          <Field key={key} label={label} optional>{({ id }) => <Input id={id} name={key} defaultValue={text(key)} />}</Field>
        ))}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-ink-muted">Plateforme</legend>
        <Checkbox name="platform.organization_signup_enabled" defaultChecked={values['platform.organization_signup_enabled'] !== false} label="Autoriser les demandes d’espace organisme depuis le site" />
        <Field label="Durée de conservation des données (mois)">{({ id }) => <Input id={id} name="platform.data_retention_months" type="number" min={1} max={120} defaultValue={Number(values['platform.data_retention_months'] ?? 36)} />}</Field>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton>Enregistrer les paramètres</SubmitButton>
    </form>
  );
}
