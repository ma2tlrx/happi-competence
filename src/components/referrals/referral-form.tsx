'use client';

import { Send } from 'lucide-react';
import { useActionState } from 'react';

import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { Notice } from '@/components/ui/primitives';
import type { ActionState } from '@/lib/action-state';
import {
  AGE_BANDS,
  CONSENT_TEXTS,
  CONSTRAINT_CODES,
  CONSTRAINTS_DETAILS_MAX,
  DAY_CODES,
  DAYS,
  FIELD_PURPOSES,
  INFORMATION_POINTS,
  OBJECTIVES_MAX,
  PRACTICAL_CONSTRAINTS,
  REASON_MAX,
  SLOT_CODES,
  SLOTS,
} from '@/lib/referrals/fields';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Question oui / non sous forme de boutons radio (aucune valeur par défaut imposée pour les consentements). */
export function YesNo({
  name,
  legend,
  description,
  error,
  defaultValue,
}: {
  name: string;
  legend: string;
  description?: string;
  error?: string;
  defaultValue?: boolean | null;
}) {
  const describedBy = description ? `${name}-aide` : undefined;
  return (
    <fieldset className="space-y-2" aria-describedby={describedBy}>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {description ? (
        <p id={describedBy} className="text-sm text-ink-subtle">
          {description}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {[
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' },
        ].map((option) => (
          <label
            key={option.value}
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-line-strong px-3 text-[0.9375rem] has-[:checked]:border-petrol-900 has-[:checked]:bg-petrol-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-orange-500"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={defaultValue === undefined || defaultValue === null ? undefined : (option.value === 'oui') === defaultValue}
              className="size-4 accent-petrol-900"
              required
            />
            {option.label}
          </label>
        ))}
      </div>
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
    </fieldset>
  );
}

function CheckboxGroup({ name, legend, hint, options }: { name: string; legend: string; hint?: string; options: { value: string; label: string }[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-ink">
        {legend} <span className="font-normal text-ink-subtle">facultatif</span>
      </legend>
      {hint ? <p className="text-sm text-ink-subtle">{hint}</p> : null}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <Checkbox key={option.value} name={name} value={option.value} label={option.label} />
        ))}
      </div>
    </fieldset>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-line bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-[1.0625rem] font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ReferralForm({ action, programs, referentName }: { action: Action; programs: { id: string; name: string }[]; referentName: string }) {
  const [state, formAction] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Notice title="Ne renseignez que le nécessaire">
        Chaque champ indique pourquoi il est demandé. N’indiquez ni date de naissance, ni information de santé, ni situation judiciaire : l’équipe HAPPI
        échangera directement avec la personne si besoin.
      </Notice>

      <Section title="La personne orientée">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" required error={errors.firstName} hint={FIELD_PURPOSES.identity}>
            {({ id, describedBy, invalid }) => <Input id={id} name="firstName" autoComplete="off" maxLength={80} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
          </Field>
          <Field label="Nom" required error={errors.lastName}>
            {({ id, invalid }) => <Input id={id} name="lastName" autoComplete="off" maxLength={80} aria-invalid={invalid || undefined} />}
          </Field>
          <Field label="Adresse e-mail de la personne" required error={errors.email} hint={FIELD_PURPOSES.email}>
            {({ id, describedBy, invalid }) => <Input id={id} name="email" type="email" autoComplete="off" aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
          </Field>
          <Field label="Téléphone" optional error={errors.phone} hint={FIELD_PURPOSES.phone}>
            {({ id, describedBy, invalid }) => <Input id={id} name="phone" type="tel" autoComplete="off" aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
          </Field>
          <Field label="Tranche d’âge" optional error={errors.ageBand} hint={FIELD_PURPOSES.ageBand}>
            {({ id, describedBy }) => (
              <Select id={id} name="ageBand" defaultValue="" aria-describedby={describedBy}>
                <option value="">Non précisée</option>
                {Object.entries(AGE_BANDS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Section>

      <Section title="L’orientation">
        <Field label="Motif de l’orientation" required error={errors.reason} hint={`${FIELD_PURPOSES.reason} ${REASON_MAX} caractères au maximum.`}>
          {({ id, describedBy, invalid }) => <Textarea id={id} name="reason" rows={4} maxLength={REASON_MAX} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
        </Field>
        <Field label="Objectifs de la personne" optional error={errors.objectives} hint={FIELD_PURPOSES.objectives}>
          {({ id, describedBy, invalid }) => <Textarea id={id} name="objectives" rows={3} maxLength={OBJECTIVES_MAX} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Programme souhaité" optional error={errors.programId} hint={FIELD_PURPOSES.program}>
            {({ id, describedBy }) => (
              <Select id={id} name="programId" defaultValue={programs.length === 1 ? programs[0]!.id : ''} aria-describedby={describedBy}>
                <option value="">À définir avec l’équipe HAPPI</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Démarrage souhaité à partir du" optional error={errors.desiredStartDate} hint={FIELD_PURPOSES.startDate}>
            {({ id, describedBy, invalid }) => <Input id={id} name="desiredStartDate" type="date" min={today} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
          </Field>
        </div>
      </Section>

      <Section title="Organisation" description={FIELD_PURPOSES.availability}>
        <CheckboxGroup name="availabilityDays" legend="Jours possibles" options={DAY_CODES.map((value) => ({ value, label: DAYS[value] }))} />
        <CheckboxGroup name="availabilitySlots" legend="Créneaux possibles" options={SLOT_CODES.map((value) => ({ value, label: SLOTS[value] }))} />
        <CheckboxGroup
          name="practicalConstraints"
          legend="Contraintes pratiques"
          hint={FIELD_PURPOSES.constraints}
          options={CONSTRAINT_CODES.map((value) => ({ value, label: PRACTICAL_CONSTRAINTS[value] }))}
        />
        <Field label="Précision sur les contraintes" optional error={errors.constraintsDetails} hint="Par exemple : « pas de séance avant 9 h 30 ». Aucune information de santé.">
          {({ id, describedBy, invalid }) => (
            <Input id={id} name="constraintsDetails" maxLength={CONSTRAINTS_DETAILS_MAX} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
          )}
        </Field>
        <YesNo name="needsAccommodation" legend="La personne a-t-elle besoin d’une adaptation (accessibilité, rythme…) ?" description={FIELD_PURPOSES.accommodation} error={errors.needsAccommodation} />
      </Section>

      <Section title="Information et consentements" description="La personne confirmera elle-même ses choix lorsqu’elle créera son compte, et pourra les modifier à tout moment.">
        <div className="rounded-md border border-line bg-paper p-4">
          <p className="text-sm font-semibold">Information à transmettre à la personne</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            {INFORMATION_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <Checkbox
          name="informed"
          label="J’ai informé la personne du traitement de ses données, dans les termes ci-dessus."
          description="Obligatoire. La date et l’heure sont enregistrées."
          error={errors.informed}
        />
        <YesNo name="consentImage" legend={CONSENT_TEXTS.image.question} description={CONSENT_TEXTS.image.note} error={errors.consentImage} />
        <YesNo name="consentShareResults" legend={CONSENT_TEXTS.shareResults.question} description={CONSENT_TEXTS.shareResults.note} error={errors.consentShareResults} />
      </Section>

      <p className="text-sm text-ink-muted">Référent de l’orientation : {referentName} (vous). Vous serez prévenu(e) à chaque étape.</p>
      <FormMessage state={state} />
      <SubmitButton>
        <Send aria-hidden />
        Envoyer l’orientation
      </SubmitButton>
    </form>
  );
}
