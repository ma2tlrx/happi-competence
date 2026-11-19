'use client';

import { Award, Ban, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { MAX_SKILL_CONDITIONS, type AwardRule } from '@/lib/badges/rules';

import { issueBadge, revokeBadge, saveBadgeClass } from './actions';

export type SkillChoice = { key: string; label: string };
export type BadgeClassValues = {
  id: string;
  name: string;
  description: string;
  criteria: string;
  imageUrl: string;
  relatedSkills: string[];
  rule: AwardRule;
  validated: boolean;
  active: boolean;
};

/** Création et modification d'un modèle de badge, avec sa règle d'attribution. */
export function BadgeClassForm({ values, skills }: { values?: BadgeClassValues; skills: SkillChoice[] }) {
  const [state, action] = useActionState(saveBadgeClass, null);
  const router = useRouter();
  const errors = state?.fieldErrors ?? {};
  const [validated, setValidated] = useState(values?.validated ?? false);
  const hours = values?.rule.conditions.find((condition) => condition.type === 'realised_hours');
  const completed = values?.rule.conditions.some((condition) => condition.type === 'program_completed') ?? false;
  const skillConditions = (values?.rule.conditions ?? []).filter((condition) => condition.type === 'skill_level');

  useEffect(() => {
    if (state?.ok && !values && state.data?.id) router.push(`/admin/badges/${state.data.id}`);
  }, [state, values, router]);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={values?.id ?? ''} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom du badge" required error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} name="name" defaultValue={values?.name} maxLength={120} required aria-describedby={describedBy} aria-invalid={invalid || undefined} />
          )}
        </Field>
        <Field label="Image" optional error={errors.imageUrl} hint="Adresse https:// ou chemin du site, par exemple /brand/happi-mascotte.png.">
          {({ id, describedBy, invalid }) => (
            <Input id={id} name="imageUrl" defaultValue={values?.imageUrl} maxLength={500} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
          )}
        </Field>
      </div>
      <Field label="Description" required error={errors.description} hint="Ce que le badge atteste, tel qu’il apparaîtra dans le portefeuille du participant.">
        {({ id, describedBy, invalid }) => (
          <Textarea id={id} name="description" defaultValue={values?.description} rows={3} maxLength={2000} required aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>
      <Field label="Critères d’obtention (texte inscrit dans le badge)" required error={errors.criteria} hint="Décision de l’équipe HAPPI. Ce texte est signé dans chaque badge émis.">
        {({ id, describedBy, invalid }) => (
          <Textarea id={id} name="criteria" defaultValue={values?.criteria} rows={4} maxLength={4000} required aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>

      {skills.length > 0 ? (
        <fieldset>
          <legend className="text-sm font-semibold text-ink">
            Compétences rattachées <span className="font-normal text-ink-subtle">facultatif — inscrites comme étiquettes du badge</span>
          </legend>
          <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto rounded-md border border-line p-3 sm:grid-cols-2">
            {skills.map((skill) => (
              <Checkbox key={skill.key} name="relatedSkill" value={skill.key} label={skill.label} defaultChecked={values?.relatedSkills.includes(skill.key)} />
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="space-y-4 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Règle de suggestion</legend>
        <p className="text-sm text-ink-muted">
          Facultatif. La règle sert seulement à lister les participants éligibles : aucun badge n’est émis automatiquement. Toutes les conditions cochées doivent être
          remplies, groupe par groupe. Sans condition, personne n’est suggéré et l’émission reste manuelle.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Checkbox name="useHours" label="Heures réalisées au moins" description="Règle du certificat de réalisation." defaultChecked={Boolean(hours)} />
          <Field label="Nombre d’heures" className="w-36">
            {({ id }) => <Input id={id} name="minHours" type="number" min={0.5} max={200} step={0.5} inputMode="decimal" defaultValue={hours?.type === 'realised_hours' ? hours.minHours : ''} />}
          </Field>
        </div>
        <Checkbox name="programCompleted" label="Programme terminé" description="Groupe clôturé, ou toutes les séances prévues terminées." defaultChecked={completed} />
        {skills.length > 0
          ? Array.from({ length: MAX_SKILL_CONDITIONS }, (_, index) => {
              const condition = skillConditions[index];
              const current = condition?.type === 'skill_level' ? condition : null;
              return (
                <div key={index} className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
                  <Field label={`Compétence ${index + 1}`} optional>
                    {({ id }) => (
                      <Select id={id} name={`skill_${index}`} defaultValue={current ? `${current.frameworkCode}:${current.skillCode}` : ''}>
                        <option value="">Aucune</option>
                        {skills.map((skill) => (
                          <option key={skill.key} value={skill.key}>
                            {skill.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Niveau validé ≥">
                    {({ id }) => <Input id={id} name={`level_${index}`} type="number" min={0} max={100} step={0.5} inputMode="decimal" defaultValue={current?.minLevel ?? ''} />}
                  </Field>
                  <Field label="Nombre de fois">
                    {({ id }) => <Input id={id} name={`times_${index}`} type="number" min={1} max={24} step={1} inputMode="numeric" defaultValue={current?.minTimes ?? ''} />}
                  </Field>
                </div>
              );
            })
          : null}
      </fieldset>

      <div className="space-y-3">
        <Checkbox
          name="validated"
          checked={validated}
          onChange={(event) => setValidated(event.target.checked)}
          label="Critère validé par l’équipe HAPPI"
          description="Retire la mention « provisoire — à valider ». Obligatoire avant d’activer le modèle."
        />
        <Checkbox
          name="active"
          defaultChecked={values?.active}
          disabled={!validated}
          label="Modèle actif"
          description="Un modèle actif peut être émis. Le désactiver n’annule pas les badges déjà émis."
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton>
        <Save aria-hidden />
        {values ? 'Enregistrer le modèle' : 'Créer le modèle'}
      </SubmitButton>
    </form>
  );
}

function useIssue() {
  const [pending, start] = useTransition();
  const run = (badgeClassId: string, participantId: string, groupId: string | null, name: string) =>
    start(async () => {
      if (!window.confirm(`Émettre ce badge signé pour ${name} ? Il pourra être révoqué, mais pas modifié.`)) return;
      const result = await issueBadge(badgeClassId, participantId, groupId);
      if (result.ok) toast.success(`Badge émis pour ${name}.`);
      else toast.error(result.message ?? 'Émission impossible.');
    });
  return { pending, run };
}

export function IssueButton({ badgeClassId, participantId, groupId, name, disabled }: { badgeClassId: string; participantId: string; groupId: string; name: string; disabled?: boolean }) {
  const { pending, run } = useIssue();
  return (
    <Button size="sm" loading={pending} disabled={disabled} onClick={() => run(badgeClassId, participantId, groupId, name)}>
      <Award aria-hidden />
      Émettre
    </Button>
  );
}

/** Émission manuelle : n'importe quel participant membre d'un groupe, éligible ou non selon la règle. */
export function ManualIssueForm({ badgeClassId, options, disabled }: { badgeClassId: string; options: { value: string; label: string }[]; disabled?: boolean }) {
  const { pending, run } = useIssue();
  const [choice, setChoice] = useState('');
  const selected = options.find((option) => option.value === choice);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label="Participant et groupe" className="min-w-0 flex-1">
        {({ id }) => (
          <Select id={id} value={choice} onChange={(event) => setChoice(event.target.value)} disabled={disabled}>
            <option value="">Choisir…</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Button
        loading={pending}
        disabled={disabled || !selected}
        onClick={() => {
          if (!selected) return;
          const [participantId, groupId] = selected.value.split('|');
          run(badgeClassId, participantId!, groupId || null, selected.label);
        }}
      >
        <Award aria-hidden />
        Émettre manuellement
      </Button>
    </div>
  );
}

export function RevokeBadgeButton({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState(revokeBadge, null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="danger-outline">
          <Ban aria-hidden />
          Révoquer
        </Button>
      </DialogTrigger>
      <DialogContent title={`Révoquer le badge de ${name}`} description="La page de vérification indiquera que le badge est révoqué. Le participant en est informé ; le motif reste interne.">
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <Field label="Motif" required error={state?.fieldErrors?.reason}>
            {({ id: fieldId, describedBy, invalid }) => (
              <Textarea id={fieldId} name="reason" rows={3} minLength={3} maxLength={500} required aria-describedby={describedBy} aria-invalid={invalid || undefined} />
            )}
          </Field>
          <FormMessage state={state} />
          <SubmitButton variant="danger" disabled={state?.ok}>
            Confirmer la révocation
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
