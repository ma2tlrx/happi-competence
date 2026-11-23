'use client';

import { ArrowLeft, Check, CircleAlert, CloudCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Notice, PageHeader } from '@/components/ui/primitives';
import {
  AGE_BANDS,
  APTITUDES,
  EXPERIENCES,
  INTAKE_STEPS,
  RESIDENCES,
  SECTORS,
  SITUATIONS,
  STUDY_LEVELS,
  TOTAL_STEPS,
  TWO_YEAR_PLANS,
  VOLUNTEERING,
  VOLUNTEERING_FIELDS,
  type IntakeStep,
} from '@/lib/intake/codes';
import { parseStep } from '@/lib/intake/schema';
import { cn } from '@/lib/utils';

import { saveIntakeStep } from './actions';

export type IntakeValues = {
  age_band: string;
  situation: string;
  residence: string;
  residence_detail: string;
  phone: string;
  study_level: string;
  study_field: string;
  school: string;
  volunteering: string;
  volunteering_fields: string[];
  experience: string;
  experience_detail: string;
  sectors: string[];
  ambitions: string;
  two_year_plan: string;
  aptitude_punctuality: number | null;
  aptitude_motivation: number | null;
  aptitude_communication: number | null;
  aptitude_initiative: number | null;
};

const STEP_FIELDS: Record<IntakeStep, (keyof IntakeValues)[]> = {
  1: ['age_band', 'situation', 'residence', 'residence_detail', 'phone'],
  2: ['study_level', 'study_field', 'school'],
  3: ['volunteering', 'volunteering_fields', 'experience', 'experience_detail'],
  4: ['sectors', 'ambitions', 'two_year_plan'],
  5: ['aptitude_punctuality', 'aptitude_motivation', 'aptitude_communication', 'aptitude_initiative'],
};

function payload(step: IntakeStep, values: IntakeValues) {
  return Object.fromEntries(STEP_FIELDS[step].map((key) => [key, values[key]]));
}

/** Barre collante, comme celle de l'auto-évaluation : où j'en suis, et ce qui est enregistré. Six cases : les cinq étapes, puis l'auto-évaluation. */
function StepProgress({ step }: { step: number }) {
  return (
    <div className="sticky top-16 z-10 -mx-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:bg-white/95 sm:px-5">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="shrink-0 font-semibold whitespace-nowrap text-ink">
          Étape {step} sur {TOTAL_STEPS}
        </span>
        <span className="inline-flex items-center gap-1.5 text-right text-ink-muted">
          <CloudCheck className="size-4 text-success" aria-hidden />
          Réponses enregistrées à chaque étape
        </span>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {Array.from({ length: TOTAL_STEPS }, (_, index) => (
          <span key={index} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', index < step ? 'bg-orange-500' : 'bg-petrol-100')} />
        ))}
      </div>
    </div>
  );
}

function GroupError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-3 flex items-start gap-1.5 text-sm font-medium text-danger">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

/** Une question = une carte, comme chaque affirmation de l'auto-évaluation. `data-invalid` sert à placer le focus sur la première erreur. */
function QuestionCard({ invalid, children }: { invalid?: boolean; children: ReactNode }) {
  return (
    <div data-invalid={invalid ? '' : undefined} className={cn('rounded-lg border bg-white p-5', invalid ? 'border-danger' : 'border-line')}>
      {children}
    </div>
  );
}

const choiceBase =
  'flex min-h-12 cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-[0.9375rem] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-orange-500';
const choiceOff = 'border-petrol-500 bg-white text-ink hover:border-petrol-700';
const choiceOn = 'border-petrol-900 bg-petrol-900 text-white';

/** Une question à choix unique : des choix en cartes alignées (vrais boutons radio dessous), comme l'échelle de l'auto-évaluation. */
function ChoiceCards({
  name,
  legend,
  required,
  options,
  value,
  onChange,
  error,
}: {
  name: string;
  legend: string;
  required?: boolean;
  options: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const errorId = `${name}-erreur`;
  return (
    <QuestionCard invalid={Boolean(error)}>
      <fieldset aria-describedby={error ? errorId : undefined}>
        <legend className="font-medium text-ink">
          {legend}
          {required ? (
            <span className="ml-0.5 text-orange-700" aria-hidden>
              *
            </span>
          ) : null}
        </legend>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(options).map(([code, label]) => {
            const on = value === code;
            return (
              <label key={code} className={cn(choiceBase, on ? choiceOn : choiceOff)}>
                <input type="radio" name={name} value={code} checked={on} onChange={() => onChange(code)} className="sr-only" required={required} />
                {on ? <Check className="size-4 shrink-0" strokeWidth={3} aria-hidden /> : null}
                {label}
              </label>
            );
          })}
        </div>
        <GroupError id={errorId} message={error} />
      </fieldset>
    </QuestionCard>
  );
}

/** Une question à choix multiples. */
function MultiChoiceCards({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
  error,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: Record<string, string>;
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}) {
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code]);
  return (
    <QuestionCard invalid={Boolean(error)}>
      <fieldset aria-describedby={error ? `${name}-erreur` : undefined}>
        <legend className="font-medium text-ink">
          {legend}
          <span className="ml-1.5 text-sm font-normal text-ink-subtle">facultatif</span>
        </legend>
        {hint ? <p className="mt-1 text-sm text-ink-muted">{hint}</p> : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(options).map(([code, label]) => {
            const on = value.includes(code);
            return (
              <label key={code} className={cn(choiceBase, on ? choiceOn : choiceOff)}>
                <input type="checkbox" name={name} value={code} checked={on} onChange={() => toggle(code)} className="sr-only" />
                <span aria-hidden className={cn('flex size-5 shrink-0 items-center justify-center rounded-xs border', on ? 'border-white bg-white text-petrol-900' : 'border-petrol-500 bg-white')}>
                  {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
                {label}
              </label>
            );
          })}
        </div>
        <GroupError id={`${name}-erreur`} message={error} />
      </fieldset>
    </QuestionCard>
  );
}

/** Une aptitude notée de 1 à 5, facultative (une note se retire avec « Effacer »). Même échelle en cartes que l'auto-évaluation. */
function RatingRow({ name, label, value, onChange }: { name: string; label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <QuestionCard>
      <fieldset>
        <div className="flex items-baseline justify-between gap-3">
          <legend className="font-medium text-ink">{label}</legend>
          {value !== null ? (
            <button type="button" onClick={() => onChange(null)} className="inline-flex min-h-11 items-center text-sm text-ink-muted underline underline-offset-4 hover:text-ink">
              Effacer
            </button>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5].map((level) => {
            const on = value === level;
            return (
              <label key={level} className={cn(choiceBase, 'justify-center font-display text-base font-semibold', on ? choiceOn : choiceOff)}>
                <input type="radio" name={name} value={level} checked={on} onChange={() => onChange(level)} className="sr-only" aria-label={`${label} : ${level} sur 5`} />
                <span aria-hidden className="flex items-center gap-1">
                  {on ? <Check className="size-4" strokeWidth={3} /> : null}
                  {level}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </QuestionCard>
  );
}

/** Champ libre dans sa carte (largeur de lecture limitée : un champ de saisie n'a pas à courir sur tout l'écran). */
function FieldCard({ error, wide, children }: { error?: string; wide?: boolean; children: ReactNode }) {
  return (
    <QuestionCard invalid={Boolean(error)}>
      <div className={wide ? 'max-w-2xl' : 'max-w-xl'}>{children}</div>
    </QuestionCard>
  );
}

export function IntakeWizard({
  initial,
  startStep,
  firstName,
  mode,
  selfAssessmentDone,
}: {
  initial: IntakeValues;
  startStep: IntakeStep;
  firstName: string;
  mode: 'accueil' | 'modifier';
  /** L'auto-évaluation (étape 6) est déjà faite : la dernière étape termine le questionnaire. */
  selfAssessmentDone: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<IntakeStep>(startStep);
  const [values, setValues] = useState<IntakeValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  // Incrémenté à chaque envoi refusé : place le focus sur la première question à corriger.
  const [errorTick, setErrorTick] = useState(0);
  const meta = INTAKE_STEPS[step - 1]!;

  // Changement d'étape : retour en haut et focus sur le titre (lecteurs d'écran), sauf au premier affichage.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    heading.current?.focus();
  }, [step]);

  // Après un envoi refusé, le focus va sur le premier champ de la première question en erreur.
  useEffect(() => {
    if (errorTick === 0) return;
    const card = document.querySelector<HTMLElement>('[data-invalid]');
    card?.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select')?.focus();
  }, [errorTick]);

  const set = <K extends keyof IntakeValues>(key: K, value: IntakeValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const next = () => {
    const data = payload(step, values);
    const check = parseStep(step, data);
    if (!check.ok) {
      const found: Record<string, string> = {};
      for (const issue of check.error.issues) {
        const key = String(issue.path[0] ?? '_');
        found[key] ??= issue.message;
      }
      setErrors(found);
      setMessage('Certaines réponses sont à compléter.');
      setErrorTick((tick) => tick + 1);
      return;
    }
    setMessage(null);
    start(async () => {
      const result = await saveIntakeStep(step, data, mode);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
        setErrorTick((tick) => tick + 1);
        return;
      }
      if (result.next) {
        router.push(result.next);
        return;
      }
      setErrors({});
      setStep((current) => Math.min(current + 1, 5) as IntakeStep);
    });
  };

  const back = () => {
    setErrors({});
    setMessage(null);
    setStep((current) => Math.max(current - 1, 1) as IntakeStep);
  };

  const showVolunteeringFields = values.volunteering === 'regulier' || values.volunteering === 'ponctuel';
  const showExperienceDetail = Boolean(values.experience) && values.experience !== 'aucune';
  const showResidenceDetail = values.residence === 'villages_alentours' || values.residence === 'autre_ville';


  return (
    <>
      <PageHeader
        titleRef={heading}
        back={<span className="text-ink-subtle">{mode === 'modifier' ? 'Mes réponses au questionnaire d’accueil' : 'Formulaire HAPPI · environ 5 minutes'}</span>}
        title={meta.title}
        description={meta.subtitle}
        actions={
          <Link
            href={mode === 'modifier' ? '/participant/profil' : '/participant/dashboard'}
            className="inline-flex min-h-11 items-center text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            {mode === 'modifier' ? 'Annuler' : 'Passer pour l’instant'}
          </Link>
        }
      />

      {step === 1 && mode === 'accueil' ? (
        <section className="mb-5 flex items-center gap-4 rounded-lg border border-line bg-white p-4" aria-label="Bienvenue">
          <Image src="/brand/happi-mascotte-3d.webp" alt="" width={64} height={104} className="h-20 w-auto shrink-0" priority />
          <div>
            <p className="font-display text-lg font-semibold text-ink">Bienvenue dans le programme HAPPI, {firstName} !</p>
            <p className="mt-1 max-w-2xl text-[0.9375rem] text-ink-muted">Ce formulaire nous aide à mieux te connaître pour personnaliser ton parcours. Il prend environ 5 minutes.</p>
          </div>
        </section>
      ) : null}

      <div className="space-y-5">
        <StepProgress step={step} />

        <div className="space-y-3">
          {step === 1 ? (
            <>
              <ChoiceCards name="age_band" legend="Quel est ton âge ?" required options={AGE_BANDS} value={values.age_band} onChange={(v) => set('age_band', v)} error={errors.age_band} />
              <ChoiceCards name="situation" legend="Quelle est ta situation actuelle ?" required options={SITUATIONS} value={values.situation} onChange={(v) => set('situation', v)} error={errors.situation} />
              <ChoiceCards name="residence" legend="Dans quelle ville habites-tu ?" required options={RESIDENCES} value={values.residence} onChange={(v) => set('residence', v)} error={errors.residence} />
              {showResidenceDetail ? (
                <FieldCard error={errors.residence_detail}>
                  <Field label="Précise ta ville / ton village" optional error={errors.residence_detail}>
                    {({ id, describedBy, invalid }) => (
                      <Input id={id} value={values.residence_detail} onChange={(event) => set('residence_detail', event.target.value)} maxLength={120} autoComplete="address-level2" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                    )}
                  </Field>
                </FieldCard>
              ) : null}
              <FieldCard error={errors.phone}>
                <Field label="Ton numéro de téléphone" optional error={errors.phone}>
                  {({ id, describedBy, invalid }) => (
                    <Input id={id} type="tel" value={values.phone} onChange={(event) => set('phone', event.target.value)} placeholder="06 00 00 00 00" autoComplete="tel" maxLength={20} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                  )}
                </Field>
              </FieldCard>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <ChoiceCards name="study_level" legend="Quel est ton niveau d’études ?" required options={STUDY_LEVELS} value={values.study_level} onChange={(v) => set('study_level', v)} error={errors.study_level} />
              <FieldCard error={errors.study_field}>
                <Field label="Dans quel domaine as-tu étudié ?" optional error={errors.study_field}>
                  {({ id, describedBy, invalid }) => (
                    <Input id={id} value={values.study_field} onChange={(event) => set('study_field', event.target.value)} placeholder="Ex : Commerce, Informatique, Santé…" maxLength={200} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                  )}
                </Field>
              </FieldCard>
              <FieldCard error={errors.school}>
                <Field label="Dans quel établissement ? (lycée, université…)" optional error={errors.school}>
                  {({ id, describedBy, invalid }) => (
                    <Input id={id} value={values.school} onChange={(event) => set('school', event.target.value)} placeholder="Nom de l’établissement" maxLength={200} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                  )}
                </Field>
              </FieldCard>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <ChoiceCards name="volunteering" legend="Est-ce que tu pratiques une activité bénévole ?" required options={VOLUNTEERING} value={values.volunteering} onChange={(v) => set('volunteering', v)} error={errors.volunteering} />
              {showVolunteeringFields ? (
                <MultiChoiceCards
                  name="volunteering_fields"
                  legend="Dans quel(s) domaine(s) ?"
                  options={VOLUNTEERING_FIELDS}
                  value={values.volunteering_fields}
                  onChange={(v) => set('volunteering_fields', v)}
                  error={errors.volunteering_fields}
                />
              ) : null}
              <ChoiceCards name="experience" legend="As-tu une expérience professionnelle ?" required options={EXPERIENCES} value={values.experience} onChange={(v) => set('experience', v)} error={errors.experience} />
              {showExperienceDetail ? (
                <FieldCard wide error={errors.experience_detail}>
                  <Field label="Décris brièvement ton expérience" optional error={errors.experience_detail}>
                    {({ id, describedBy, invalid }) => (
                      <Textarea id={id} rows={3} value={values.experience_detail} onChange={(event) => set('experience_detail', event.target.value)} placeholder="Poste occupé, durée, entreprise…" maxLength={1000} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                    )}
                  </Field>
                </FieldCard>
              ) : null}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <MultiChoiceCards name="sectors" legend="Quels secteurs professionnels t’attirent ?" options={SECTORS} value={values.sectors} onChange={(v) => set('sectors', v)} error={errors.sectors} />
              <FieldCard wide error={errors.ambitions}>
                <Field label="Décris tes ambitions professionnelles" optional error={errors.ambitions}>
                  {({ id, describedBy, invalid }) => (
                    <Textarea id={id} rows={3} value={values.ambitions} onChange={(event) => set('ambitions', event.target.value)} placeholder="Quel métier souhaites-tu exercer ? Quels sont tes projets ?" maxLength={1000} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                  )}
                </Field>
              </FieldCard>
              <ChoiceCards name="two_year_plan" legend="Dans 2 ans, tu souhaites…" required options={TWO_YEAR_PLANS} value={values.two_year_plan} onChange={(v) => set('two_year_plan', v)} error={errors.two_year_plan} />
            </>
          ) : null}

          {step === 5 ? (
            <>
              <p className="flex justify-between gap-3 text-sm text-ink-muted" aria-hidden>
                <span>1 = Très faible</span>
                <span>3 = Moyen</span>
                <span>5 = Excellent</span>
              </p>
              {(Object.entries(APTITUDES) as [keyof typeof APTITUDES, string][]).map(([key, label]) => (
                <RatingRow key={key} name={key} label={label} value={values[key]} onChange={(v) => set(key, v)} />
              ))}
              <Notice title="Qui voit tes réponses ?">
                Ces informations permettent à ton formateur de mieux comprendre ton profil et de personnaliser ton accompagnement. Seuls toi, tes formateurs et l’équipe HAPPI voient tes réponses.
              </Notice>
            </>
          ) : null}
        </div>

        <div className="space-y-4 rounded-lg border border-line bg-white p-5">
          {message ? (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {message}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="lg" onClick={next} loading={pending}>
              {step < 5 ? 'Suivant' : mode === 'modifier' ? 'Enregistrer mes réponses' : selfAssessmentDone ? 'Terminer le formulaire' : 'Suivant : mon auto-évaluation'}
            </Button>
            {step > 1 ? (
              <Button type="button" variant="ghost" size="lg" onClick={back} disabled={pending}>
                <ArrowLeft aria-hidden />
                Retour
              </Button>
            ) : null}
            {step >= 5 && mode === 'accueil' ? <span className="text-sm text-ink-muted">Les aptitudes sont optionnelles.</span> : null}
          </div>
        </div>
      </div>
    </>
  );
}
