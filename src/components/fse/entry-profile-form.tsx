'use client';

import { useActionState, useState } from 'react';

import { Checkbox, Field, FormMessage, Input, Select, SubmitButton } from '@/components/ui/form';
import { ProvisionalBadge } from '@/components/ui/primitives';
import type { ActionState } from '@/lib/action-state';
import {
  AGE_BANDS,
  ANSWERS,
  DIPLOMA_LEVELS,
  GENDERS,
  LABOUR_STATUSES,
  OPTIONAL_FIELDS,
  SCHEME_FIELDS,
  UNEMPLOYMENT_DURATIONS,
  type AnswerField,
  type EntryProfileValues,
} from '@/lib/fse/codes';
import { cn } from '@/lib/utils';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;
type Option = { value: string; label: string; hint?: string | null };

const pill =
  'flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-white px-3 py-1.5 text-[0.9375rem] ' +
  'has-[:checked]:border-petrol-900 has-[:checked]:bg-petrol-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-orange-500';

/** Groupe de boutons radio accessible (fieldset + legend), qui passe à la ligne sur petit écran. */
function Choices({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
  error,
  stacked,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: Option[];
  value: string;
  onChange?: (value: string) => void;
  error?: string;
  stacked?: boolean;
}) {
  const hintId = hint ? `${name}-aide` : undefined;
  return (
    <fieldset className="space-y-2" aria-describedby={hintId}>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-subtle">
          {hint}
        </p>
      ) : null}
      <div className={cn('flex gap-2', stacked ? 'flex-col' : 'flex-wrap')}>
        {options.map((option) => (
          <label key={option.value || 'vide'} className={pill}>
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={onChange ? undefined : value === option.value}
              checked={onChange ? value === option.value : undefined}
              onChange={onChange ? () => onChange(option.value) : undefined}
              className="size-4 shrink-0 accent-petrol-900"
            />
            <span>
              {option.label}
              {option.hint ? <span className="block text-sm text-ink-subtle">{option.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
    </fieldset>
  );
}

function answerOptions(field: AnswerField, professional: boolean): Option[] {
  const options: Option[] = [
    { value: 'oui', label: ANSWERS.oui },
    { value: 'non', label: ANSWERS.non },
  ];
  if (field.allowUnknown) options.push({ value: 'ne_sait_pas', label: ANSWERS.ne_sait_pas });
  options.push({ value: 'ne_souhaite_pas_repondre', label: professional ? 'Ne souhaite pas répondre' : 'Je ne souhaite pas répondre' });
  if (professional) options.push({ value: '', label: 'Non renseigné' });
  return options;
}

/**
 * Fiche d'entrée : saisie par l'organisme / l'administrateur (mode « professional ») ou complétion
 * par le participant. Toutes les questions peuvent rester sans réponse ; les questions sensibles
 * proposent toujours « Je ne souhaite pas répondre ».
 */
export function EntryProfileForm({
  action,
  participantId,
  groupId,
  values,
  mode,
  informed,
}: {
  action: Action;
  participantId?: string;
  groupId: string | null;
  values: EntryProfileValues | null;
  mode: 'professional' | 'participant';
  /** La personne a déjà été informée (case pré-cochée). */
  informed: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const [labour, setLabour] = useState<string>(values?.labourStatus ?? '');
  const errors = state?.fieldErrors ?? {};
  const professional = mode === 'professional';
  const today = new Date().toISOString().slice(0, 10);
  const you = (pro: string, self: string) => (professional ? pro : self);

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {participantId ? <input type="hidden" name="participantId" value={participantId} /> : null}
      <input type="hidden" name="groupId" value={groupId ?? ''} />

      <section className="space-y-5" aria-labelledby={`entree-${groupId ?? 'hors'}`}>
        <h3 id={`entree-${groupId ?? 'hors'}`} className="text-base font-semibold text-ink">
          {you('Situation à l’entrée', 'Votre situation au début du parcours')}
        </h3>
        {professional ? (
          <Field label="Date d’entrée dans le parcours" error={errors.entryDate} hint="Laisser vide si elle n’est pas connue.">
            {({ id, describedBy, invalid }) => (
              <Input id={id} name="entryDate" type="date" max={today} defaultValue={values?.entryDate ?? ''} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="sm:max-w-xs" />
            )}
          </Field>
        ) : null}
        <Choices
          name="labourStatus"
          legend={you('Situation sur le marché du travail', 'Au début du parcours, vous étiez :')}
          options={[
            ...Object.entries(LABOUR_STATUSES).map(([value, entry]) => ({ value, label: entry.label, hint: entry.hint })),
            ...(professional ? [{ value: '', label: 'Non renseigné' }] : []),
          ]}
          value={labour}
          onChange={setLabour}
          error={errors.labourStatus}
          stacked
        />
        {labour === 'chomeur' ? (
          <Choices
            name="unemploymentDuration"
            legend={you('Depuis combien de temps sans emploi ?', 'Depuis combien de temps êtes-vous sans emploi ?')}
            hint="Ou durée d’inscription à France Travail."
            options={Object.entries(UNEMPLOYMENT_DURATIONS).map(([value, label]) => ({ value, label }))}
            value={values?.unemploymentDuration ?? ''}
            error={errors.unemploymentDuration}
          />
        ) : null}
        <Field label={you('Plus haut diplôme obtenu', 'Votre plus haut diplôme')} error={errors.diplomaLevel} hint="Niveaux du cadre national des certifications (2019).">
          {({ id, describedBy, invalid }) => (
            <Select id={id} name="diplomaLevel" defaultValue={values?.diplomaLevel ?? ''} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
              <option value="">{professional ? 'Non renseigné' : 'Choisir'}</option>
              {Object.entries(DIPLOMA_LEVELS).map(([value, level]) => (
                <option key={value} value={value}>
                  {level.label} — {level.hint}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Choices
          name="ageBand"
          legend={you('Âge à l’entrée', 'Votre âge au début du parcours')}
          options={Object.entries(AGE_BANDS).map(([value, label]) => ({ value, label }))}
          value={values?.ageBand ?? ''}
          error={errors.ageBand}
        />
        <Choices
          name="gender"
          legend={you('Genre', 'Vous êtes :')}
          options={Object.entries(GENDERS).map(([value, label]) => ({ value, label: !professional && value === 'ne_souhaite_pas_repondre' ? 'Je ne souhaite pas répondre' : label }))}
          value={values?.gender ?? ''}
          error={errors.gender}
        />
      </section>

      <section className="space-y-5" aria-labelledby={`dispositifs-${groupId ?? 'hors'}`}>
        <h3 id={`dispositifs-${groupId ?? 'hors'}`} className="text-base font-semibold text-ink">
          {you('Dispositifs et lieu de résidence', 'Vos démarches et votre lieu de vie')}
        </h3>
        {SCHEME_FIELDS.map((field) => (
          <Choices
            key={field.column}
            name={field.column}
            legend={professional ? field.label : field.selfLabel}
            hint={field.hint}
            options={answerOptions(field, professional)}
            value={values?.answers[field.column] ?? ''}
            error={errors[field.column]}
          />
        ))}
      </section>

      <section className="space-y-5" aria-labelledby={`facultatif-${groupId ?? 'hors'}`}>
        <div>
          <h3 id={`facultatif-${groupId ?? 'hors'}`} className="text-base font-semibold text-ink">
            Questions facultatives
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            {you(
              'Données personnelles prévues par le FSE+. La personne peut toujours refuser de répondre : ne jamais insister ni déduire la réponse.',
              'Ces questions sont personnelles. Vous pouvez toujours répondre « Je ne souhaite pas répondre ».',
            )}
          </p>
        </div>
        {OPTIONAL_FIELDS.map((field) => (
          <Choices
            key={field.column}
            name={field.column}
            legend={professional ? field.label : field.selfLabel}
            hint={field.hint}
            options={answerOptions(field, professional)}
            value={values?.answers[field.column] ?? ''}
            error={errors[field.column]}
          />
        ))}
      </section>

      <div className="space-y-4 border-t border-line pt-5">
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <ProvisionalBadge>Provisoire</ProvisionalBadge>
          <span>Nomenclatures et correspondances à valider avec l’autorité de gestion du FSE+.</span>
        </p>
        <Checkbox
          name="informed"
          defaultChecked={informed}
          error={errors.informed}
          label={you(
            'La personne a reçu l’information sur l’utilisation de ces données (finalité, destinataires, droit de ne pas répondre).',
            'J’ai lu l’information sur l’utilisation de mes réponses.',
          )}
        />
        <FormMessage state={state} />
        <SubmitButton className="w-full sm:w-auto">{you('Enregistrer la fiche', 'Enregistrer mes réponses')}</SubmitButton>
      </div>
    </form>
  );
}
