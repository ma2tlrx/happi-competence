'use client';

import { ArrowLeft, Check, CircleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
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

/** Six cases : les cinq étapes de ce questionnaire, puis l'auto-évaluation. */
function StepProgress({ step }: { step: number }) {
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: TOTAL_STEPS }, (_, index) => (
          <span key={index} className={cn('h-2 flex-1 rounded-[2px] transition-colors duration-300', index < step ? 'bg-orange-500' : 'bg-petrol-100')} />
        ))}
      </div>
      <p className="mt-1.5 text-right text-sm text-ink-subtle">
        Étape {step} sur {TOTAL_STEPS}
      </p>
    </div>
  );
}

function GroupError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

/** Une question à choix unique : de grandes cases faciles à toucher (vrais boutons radio dessous). */
function ChoiceCards({
  name,
  legend,
  required,
  options,
  value,
  onChange,
  columns = 1,
  error,
}: {
  name: string;
  legend: string;
  required?: boolean;
  options: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
  columns?: 1 | 2;
  error?: string;
}) {
  const errorId = `${name}-erreur`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="mb-2.5 text-[0.9375rem] font-semibold text-ink">
        {legend}
        {required ? (
          <span className="ml-0.5 text-orange-700" aria-hidden>
            *
          </span>
        ) : null}
      </legend>
      <div className={cn('grid gap-2', columns === 2 && 'sm:grid-cols-2')}>
        {Object.entries(options).map(([code, label]) => (
          <label
            key={code}
            className={cn(
              'flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-3.5 py-2.5 text-[0.9375rem] font-medium transition-colors',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-orange-500',
              value === code ? 'border-orange-500 bg-orange-50 text-ink' : 'border-line bg-white text-ink-muted hover:border-petrol-300',
            )}
          >
            <input type="radio" name={name} value={code} checked={value === code} onChange={() => onChange(code)} className="sr-only" required={required} />
            <span
              aria-hidden
              className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border-2', value === code ? 'border-orange-500 bg-orange-500' : 'border-line-strong bg-white')}
            >
              {value === code ? <span className="size-2 rounded-full bg-white" /> : null}
            </span>
            {label}
          </label>
        ))}
      </div>
      <GroupError id={errorId} message={error} />
    </fieldset>
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
  columns = 1,
  error,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: Record<string, string>;
  value: string[];
  onChange: (value: string[]) => void;
  columns?: 1 | 2;
  error?: string;
}) {
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code]);
  return (
    <fieldset>
      <legend className="mb-1 text-[0.9375rem] font-semibold text-ink">
        {legend}
        <span className="ml-1.5 text-sm font-normal text-ink-subtle">facultatif</span>
      </legend>
      {hint ? <p className="mb-2.5 text-sm text-ink-subtle">{hint}</p> : <div className="mb-1.5" />}
      <div className={cn('grid gap-2', columns === 2 && 'sm:grid-cols-2')}>
        {Object.entries(options).map(([code, label]) => {
          const on = value.includes(code);
          return (
            <label
              key={code}
              className={cn(
                'flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-3.5 py-2.5 text-[0.9375rem] font-medium transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-orange-500',
                on ? 'border-orange-500 bg-orange-50 text-ink' : 'border-line bg-white text-ink-muted hover:border-petrol-300',
              )}
            >
              <input type="checkbox" name={name} value={code} checked={on} onChange={() => toggle(code)} className="sr-only" />
              <span aria-hidden className={cn('flex size-5 shrink-0 items-center justify-center rounded-[5px] border-2', on ? 'border-orange-500 bg-orange-500 text-white' : 'border-line-strong bg-white')}>
                {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
              {label}
            </label>
          );
        })}
      </div>
      <GroupError id={`${name}-erreur`} message={error} />
    </fieldset>
  );
}

/** Une aptitude notée de 1 à 5, facultative (une note se retire avec « Effacer »). */
function RatingRow({ name, label, value, onChange }: { name: string; label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <fieldset className="border-b border-line py-4 last:border-b-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <legend className="text-[0.9375rem] font-semibold text-ink">{label}</legend>
        {value !== null ? (
          <button type="button" onClick={() => onChange(null)} className="text-sm text-ink-subtle underline-offset-4 hover:text-ink hover:underline">
            Effacer
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((level) => (
          <label
            key={level}
            className={cn(
              'flex h-12 cursor-pointer items-center justify-center rounded-lg border-2 font-display text-lg font-semibold transition-colors',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-orange-500',
              value === level ? 'border-orange-500 bg-orange-500 text-white' : 'border-line bg-white text-ink-subtle hover:border-petrol-300',
            )}
          >
            <input type="radio" name={name} value={level} checked={value === level} onChange={() => onChange(level)} className="sr-only" aria-label={`${label} : ${level} sur 5`} />
            <span aria-hidden>{level}</span>
          </label>
        ))}
      </div>
    </fieldset>
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
      return;
    }
    setMessage(null);
    start(async () => {
      const result = await saveIntakeStep(step, data, mode);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
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
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 text-white">
        <p className="text-sm text-white/70">{mode === 'modifier' ? 'Mes réponses au questionnaire d’accueil' : 'Formulaire HAPPI · environ 5 minutes'}</p>
        <Link href={mode === 'modifier' ? '/participant/profil' : '/participant/dashboard'} className="text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline">
          {mode === 'modifier' ? 'Annuler' : 'Passer pour l’instant'}
        </Link>
      </div>

      {step === 1 && mode === 'accueil' ? (
        <section className="mb-4 flex items-center gap-4 rounded-xl bg-white/[0.07] p-4 ring-1 ring-white/10" aria-label="Bienvenue">
          <Image src="/brand/happi-mascotte-3d.webp" alt="" width={64} height={104} className="h-20 w-auto shrink-0" priority />
          <div>
            <p className="font-display text-lg font-semibold text-white">Bienvenue dans le programme HAPPI, {firstName} !</p>
            <p className="mt-1 text-sm text-white/75">Ce formulaire nous aide à mieux te connaître pour personnaliser ton parcours. Il prend environ 5 minutes.</p>
          </div>
        </section>
      ) : null}

      <div className="rounded-2xl bg-white p-5 shadow-lg sm:p-7">
        <StepProgress step={step} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
            <header className="mt-5 mb-6 border-b border-line pb-4">
              <h1 ref={heading} tabIndex={-1} className="font-display text-xl font-semibold text-ink outline-none sm:text-2xl">
                {meta.title}
              </h1>
              <p className="mt-1 text-[0.9375rem] text-ink-muted">{meta.subtitle}</p>
            </header>

            <div className="space-y-7">
              {step === 1 ? (
                <>
                  <ChoiceCards name="age_band" legend="Quel est ton âge ?" required columns={2} options={AGE_BANDS} value={values.age_band} onChange={(v) => set('age_band', v)} error={errors.age_band} />
                  <ChoiceCards name="situation" legend="Quelle est ta situation actuelle ?" required options={SITUATIONS} value={values.situation} onChange={(v) => set('situation', v)} error={errors.situation} />
                  <div>
                    <ChoiceCards name="residence" legend="Dans quelle ville habites-tu ?" required options={RESIDENCES} value={values.residence} onChange={(v) => set('residence', v)} error={errors.residence} />
                    {showResidenceDetail ? (
                      <Field label="Précise ta ville / ton village" optional className="mt-3" error={errors.residence_detail}>
                        {({ id, describedBy, invalid }) => (
                          <Input id={id} value={values.residence_detail} onChange={(event) => set('residence_detail', event.target.value)} maxLength={120} autoComplete="address-level2" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                        )}
                      </Field>
                    ) : null}
                  </div>
                  <Field label="Ton numéro de téléphone" optional error={errors.phone}>
                    {({ id, describedBy, invalid }) => (
                      <Input id={id} type="tel" value={values.phone} onChange={(event) => set('phone', event.target.value)} placeholder="06 00 00 00 00" autoComplete="tel" maxLength={20} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                    )}
                  </Field>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <ChoiceCards name="study_level" legend="Quel est ton niveau d’études ?" required options={STUDY_LEVELS} value={values.study_level} onChange={(v) => set('study_level', v)} error={errors.study_level} />
                  <Field label="Dans quel domaine as-tu étudié ?" optional error={errors.study_field}>
                    {({ id, describedBy, invalid }) => (
                      <Input id={id} value={values.study_field} onChange={(event) => set('study_field', event.target.value)} placeholder="Ex : Commerce, Informatique, Santé…" maxLength={200} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                    )}
                  </Field>
                  <Field label="Dans quel établissement ? (lycée, université…)" optional error={errors.school}>
                    {({ id, describedBy, invalid }) => (
                      <Input id={id} value={values.school} onChange={(event) => set('school', event.target.value)} placeholder="Nom de l’établissement" maxLength={200} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                    )}
                  </Field>
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
                    <Field label="Décris brièvement ton expérience" optional error={errors.experience_detail}>
                      {({ id, describedBy, invalid }) => (
                        <Textarea id={id} rows={3} value={values.experience_detail} onChange={(event) => set('experience_detail', event.target.value)} placeholder="Poste occupé, durée, entreprise…" maxLength={1000} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                      )}
                    </Field>
                  ) : null}
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <MultiChoiceCards name="sectors" legend="Quels secteurs professionnels t’attirent ?" columns={2} options={SECTORS} value={values.sectors} onChange={(v) => set('sectors', v)} error={errors.sectors} />
                  <Field label="Décris tes ambitions professionnelles" optional error={errors.ambitions}>
                    {({ id, describedBy, invalid }) => (
                      <Textarea id={id} rows={3} value={values.ambitions} onChange={(event) => set('ambitions', event.target.value)} placeholder="Quel métier souhaites-tu exercer ? Quels sont tes projets ?" maxLength={1000} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                    )}
                  </Field>
                  <ChoiceCards name="two_year_plan" legend="Dans 2 ans, tu souhaites…" required options={TWO_YEAR_PLANS} value={values.two_year_plan} onChange={(v) => set('two_year_plan', v)} error={errors.two_year_plan} />
                </>
              ) : null}

              {step === 5 ? (
                <div>
                  <p className="flex justify-between text-sm text-ink-subtle" aria-hidden>
                    <span>1 = Très faible</span>
                    <span>3 = Moyen</span>
                    <span>5 = Excellent</span>
                  </p>
                  {(Object.entries(APTITUDES) as [keyof typeof APTITUDES, string][]).map(([key, label]) => (
                    <RatingRow key={key} name={key} label={label} value={values[key]} onChange={(v) => set(key, v)} />
                  ))}
                  <p className="mt-4 rounded-lg bg-orange-50 p-3.5 text-sm text-ink-muted">
                    Ces informations permettent à ton formateur de mieux comprendre ton profil et de personnaliser ton accompagnement. Seuls toi, tes formateurs et
                    l’équipe HAPPI voient tes réponses.
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>

        {message ? (
          <p role="alert" className="mt-6 flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {message}
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
          {step > 1 ? (
            <Button type="button" variant="ghost" onClick={back} disabled={pending}>
              <ArrowLeft aria-hidden />
              Retour
            </Button>
          ) : null}
          <Button type="button" size="lg" className="flex-1" onClick={next} loading={pending}>
            {step < 5 ? 'Suivant' : mode === 'modifier' ? 'Enregistrer mes réponses' : selfAssessmentDone ? 'Terminer le formulaire' : 'Suivant : mon auto-évaluation'}
          </Button>
        </div>
        {step >= 5 && mode === 'accueil' ? <p className="mt-3 text-center text-sm text-ink-subtle">Les aptitudes sont optionnelles.</p> : null}
      </div>
    </div>
  );
}
