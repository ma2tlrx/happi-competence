'use client';

import { Archive, Copy, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormMessage, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { AGGREGATION_LABELS, ROUNDING_LABELS, SCORING_MODE_LABELS } from '@/lib/evaluation-engine';

import {
  cloneQuestionnaire,
  cloneVersion,
  deleteCategory,
  deleteDraftVersion,
  deleteSkill,
  publishQuestionnaire,
  saveCategory,
  saveLevels,
  saveQuestionnaire,
  saveSkill,
  saveVersionSettings,
  setVersionStatus,
  toggleMapping,
} from './actions';

type Simple = { ok: boolean; message?: string } | undefined | void;
function useRun() {
  const [pending, start] = useTransition();
  return {
    pending,
    run: (action: () => Promise<Simple>, success: string, confirm?: string) =>
      start(async () => {
        if (confirm && !window.confirm(confirm)) return;
        const result = await action();
        if (!result || result.ok) toast.success(success);
        else toast.error(result.message ?? 'Action impossible.');
      }),
  };
}

export function CloneButton({ versionId, questionnaire }: { versionId: string; questionnaire?: boolean }) {
  const { pending, run } = useRun();
  return (
    <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => (questionnaire ? cloneQuestionnaire(versionId) : cloneVersion(versionId)), 'Nouvelle version créée.')}>
      <Copy aria-hidden />
      Nouvelle version
    </Button>
  );
}

export function VersionStatusActions({ versionId, status }: { versionId: string; status: string }) {
  const { pending, run } = useRun();
  if (status === 'draft') {
    return (
      <>
        <Button variant="danger-outline" loading={pending} onClick={() => run(() => deleteDraftVersion(versionId), 'Brouillon supprimé.', 'Supprimer définitivement ce brouillon ?')}>
          <Trash2 aria-hidden />
          Supprimer le brouillon
        </Button>
        <Button loading={pending} onClick={() => run(() => setVersionStatus(versionId, 'published'), 'Version publiée. Activez-la pour un programme depuis « Programmes ».', 'Publier cette version ? Elle ne pourra plus être modifiée.')}>
          <Send aria-hidden />
          Publier
        </Button>
      </>
    );
  }
  if (status === 'published') {
    return (
      <>
        <Button variant="ghost" loading={pending} onClick={() => run(() => setVersionStatus(versionId, 'archived'), 'Version archivée.', 'Archiver cette version ? Les évaluations existantes restent consultables.')}>
          <Archive aria-hidden />
          Archiver
        </Button>
        <CloneButton versionId={versionId} />
      </>
    );
  }
  return null;
}

type Settings = { label: string; notes: string | null; is_provisional: boolean; scale_min: number; scale_max: number; scale_step: number; scoring_mode: string; aggregation: string; rounding: string };

export function SettingsForm({ versionId, settings, published }: { versionId: string; settings: Settings; published: boolean }) {
  const [state, action] = useActionState(saveVersionSettings.bind(null, versionId, published), null);
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de la version" required error={e.label}>{({ id }) => <Input id={id} name="label" defaultValue={settings.label} />}</Field>
        <div className="flex items-end pb-2">
          <Checkbox name="isProvisional" defaultChecked={settings.is_provisional} label="Référentiel provisoire" description="Signalé aux formateurs et aux participants." />
        </div>
      </div>
      <Field label="Notes internes" optional>{({ id }) => <Textarea id={id} name="notes" rows={3} defaultValue={settings.notes ?? ''} />}</Field>
      <fieldset disabled={published} className="grid gap-4 disabled:opacity-70 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-ink-muted sm:col-span-3">{published ? 'Échelle et règles de calcul (figées pour une version publiée)' : 'Échelle et règles de calcul'}</legend>
        <Field label="Note minimale">{({ id }) => <Input id={id} name="scaleMin" type="number" min={0} max={10} defaultValue={settings.scale_min} />}</Field>
        <Field label="Note maximale" error={e.scaleMax}>{({ id }) => <Input id={id} name="scaleMax" type="number" min={1} max={20} defaultValue={settings.scale_max} />}</Field>
        <Field label="Pas">{({ id }) => <Select id={id} name="scaleStep" defaultValue={String(Number(settings.scale_step))}><option value="1">1 (notes entières)</option><option value="0.5">0,5</option></Select>}</Field>
        <Field label="Mode de notation" hint={SCORING_MODE_LABELS[settings.scoring_mode as keyof typeof SCORING_MODE_LABELS]?.description}>
          {({ id, describedBy }) => <Select id={id} name="scoringMode" defaultValue={settings.scoring_mode} aria-describedby={describedBy}>{Object.entries(SCORING_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l.label}</option>)}</Select>}
        </Field>
        <Field label="Synthèse entre sessions" hint={AGGREGATION_LABELS[settings.aggregation as keyof typeof AGGREGATION_LABELS]?.description}>
          {({ id, describedBy }) => <Select id={id} name="aggregation" defaultValue={settings.aggregation} aria-describedby={describedBy}>{Object.entries(AGGREGATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l.label}</option>)}</Select>}
        </Field>
        <Field label="Arrondi">{({ id }) => <Select id={id} name="rounding" defaultValue={settings.rounding}>{Object.entries(ROUNDING_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</Field>
      </fieldset>
      {published ? (
        <>
          <input type="hidden" name="scaleMin" value={settings.scale_min} />
          <input type="hidden" name="scaleMax" value={settings.scale_max} />
          <input type="hidden" name="scaleStep" value={String(Number(settings.scale_step))} />
          <input type="hidden" name="scoringMode" value={settings.scoring_mode} />
          <input type="hidden" name="aggregation" value={settings.aggregation} />
          <input type="hidden" name="rounding" value={settings.rounding} />
        </>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Enregistrer les paramètres</SubmitButton>
    </form>
  );
}

export function LevelsForm({ versionId, min, max, levels, disabled }: { versionId: string; min: number; max: number; levels: { value: number; label: string; description: string | null }[]; disabled: boolean }) {
  const [state, action] = useActionState(saveLevels.bind(null, versionId), null);
  return (
    <form action={action} className="space-y-3">
      <fieldset disabled={disabled} className="space-y-3">
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((value) => {
          const level = levels.find((l) => l.value === value);
          return (
            <div key={value} className="grid gap-2 sm:grid-cols-[3rem_14rem_1fr] sm:items-center">
              <span className="flex size-9 items-center justify-center rounded-md bg-petrol-900 font-semibold text-white">{value}</span>
              <Input name={`label-${value}`} aria-label={`Libellé du niveau ${value}`} defaultValue={level?.label ?? ''} placeholder="Libellé" />
              <Input name={`description-${value}`} aria-label={`Description du niveau ${value}`} defaultValue={level?.description ?? ''} placeholder="Description générale (facultative)" />
            </div>
          );
        })}
      </fieldset>
      <FormMessage state={state} />
      {!disabled ? <SubmitButton variant="secondary">Enregistrer les niveaux</SubmitButton> : null}
    </form>
  );
}

export function CategoryDialog({ versionId, category }: { versionId: string; category?: { id: string; name: string; description: string | null; position: number } }) {
  const [state, action] = useActionState(saveCategory.bind(null, versionId, category?.id ?? null), null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        {category ? <Button size="icon-sm" variant="ghost" aria-label={`Modifier la catégorie ${category.name}`}><Pencil aria-hidden /></Button> : <Button size="sm" variant="outline"><Plus aria-hidden />Catégorie</Button>}
      </DialogTrigger>
      <DialogContent title={category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}>
        <form action={action} className="space-y-4">
          <Field label="Nom" required error={state?.fieldErrors?.name}>{({ id }) => <Input id={id} name="name" defaultValue={category?.name} />}</Field>
          <Field label="Description" optional>{({ id }) => <Textarea id={id} name="description" rows={2} defaultValue={category?.description ?? ''} />}</Field>
          <Field label="Ordre d’affichage">{({ id }) => <Input id={id} name="position" type="number" defaultValue={category?.position ?? 0} />}</Field>
          <FormMessage state={state} />
          <SubmitButton>Enregistrer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteButton({ label, onDelete, confirm }: { label: string; onDelete: () => Promise<Simple>; confirm: string }) {
  const { pending, run } = useRun();
  return (
    <Button size="icon-sm" variant="ghost" aria-label={label} loading={pending} onClick={() => run(onDelete, 'Élément supprimé.', confirm)}>
      <Trash2 aria-hidden />
    </Button>
  );
}

export function DeleteCategoryButton({ versionId, categoryId, name }: { versionId: string; categoryId: string; name: string }) {
  return <DeleteButton label={`Supprimer la catégorie ${name}`} confirm={`Supprimer la catégorie « ${name} » ? Ses compétences resteront, sans catégorie.`} onDelete={() => deleteCategory(versionId, categoryId)} />;
}

export function DeleteSkillButton({ versionId, skillId, name }: { versionId: string; skillId: string; name: string }) {
  return <DeleteButton label={`Supprimer ${name}`} confirm={`Supprimer la compétence « ${name} » de ce brouillon ?`} onDelete={() => deleteSkill(versionId, skillId)} />;
}

type SkillValue = { id: string; code: string; name: string; description: string | null; category_id: string | null; weight: number; position: number; is_active: boolean; descriptors: Record<number, string>; criteria: { label: string; weight: number }[] };

export function SkillDialog({ versionId, skill, categories, levels, disabled }: { versionId: string; skill?: SkillValue; categories: { id: string; name: string }[]; levels: { value: number; label: string }[]; disabled: boolean }) {
  const [state, action] = useActionState(saveSkill.bind(null, versionId, skill?.id ?? null), null);
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {skill ? (
          <button type="button" className="text-left font-semibold text-ink hover:text-petrol-700 hover:underline">{skill.name}</button>
        ) : (
          <Button size="sm"><Plus aria-hidden />Compétence</Button>
        )}
      </DialogTrigger>
      <DialogContent size="lg" title={skill ? skill.name : 'Nouvelle compétence'} description={disabled ? 'Version publiée : consultation seule.' : skill ? `Code stable : ${skill.code}` : 'Le code relie l’historique d’une même compétence d’une version à l’autre.'}>
        <form action={action} className="space-y-4">
          <fieldset disabled={disabled} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom" required error={state?.fieldErrors?.name}>{({ id }) => <Input id={id} name="name" defaultValue={skill?.name} />}</Field>
              {!skill ? <Field label="Code" optional hint="Généré à partir du nom si vide.">{({ id, describedBy }) => <Input id={id} name="code" aria-describedby={describedBy} />}</Field> : (
                <Field label="Catégorie">{({ id }) => <Select id={id} name="categoryId" defaultValue={skill.category_id ?? ''}><option value="">Sans catégorie</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
              )}
            </div>
            {!skill ? <Field label="Catégorie">{({ id }) => <Select id={id} name="categoryId" defaultValue=""><option value="">Sans catégorie</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field> : null}
            <Field label="Définition" optional>{({ id }) => <Textarea id={id} name="description" rows={2} defaultValue={skill?.description ?? ''} />}</Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Pondération">{({ id }) => <Input id={id} name="weight" type="number" step="0.1" min={0} defaultValue={skill?.weight ?? 1} />}</Field>
              <Field label="Ordre">{({ id }) => <Input id={id} name="position" type="number" defaultValue={skill?.position ?? 0} />}</Field>
              <div className="flex items-end pb-2"><Checkbox name="isActive" defaultChecked={skill?.is_active ?? true} label="Active" /></div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Description de chaque niveau</p>
              <div className="space-y-2">
                {levels.map((level) => (
                  <div key={level.value} className="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-start">
                    <span className="pt-2 text-sm text-ink-muted">{level.value} · {level.label}</span>
                    <Textarea name={`level-${level.value}`} rows={2} aria-label={`Description du niveau ${level.value} pour cette compétence`} defaultValue={skill?.descriptors[level.value] ?? ''} />
                  </div>
                ))}
              </div>
            </div>
            <Field label="Critères d’observation et indicateurs" optional hint="Un critère par ligne. Ajoutez « | poids » pour pondérer (ex. Écoute active | 2).">
              {({ id, describedBy }) => <Textarea id={id} name="criteria" rows={5} aria-describedby={describedBy} defaultValue={(skill?.criteria ?? []).map((c) => (c.weight !== 1 ? `${c.label} | ${c.weight}` : c.label)).join('\n')} />}
            </Field>
          </fieldset>
          <FormMessage state={state} />
          {!disabled ? <SubmitButton>Enregistrer</SubmitButton> : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MappingCheckbox({ versionId, sessionNumber, skillId, checked, disabled, label }: { versionId: string; sessionNumber: number; skillId: string; checked: boolean; disabled: boolean; label: string }) {
  const [value, setValue] = useState(checked);
  const [pending, start] = useTransition();
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={value}
      disabled={disabled || pending}
      className="size-5 cursor-pointer accent-[#102c32] disabled:cursor-default"
      onChange={(event) => {
        const next = event.target.checked;
        setValue(next);
        start(async () => {
          const result = await toggleMapping(versionId, sessionNumber, skillId, next);
          if (!result.ok) {
            setValue(!next);
            toast.error(result.message ?? 'Modification impossible.');
          }
        });
      }}
    />
  );
}

export function QuestionnaireForm({ versionId, label, intro, isProvisional, scale, questions, disabled }: { versionId: string; label: string; intro: string | null; isProvisional: boolean; scale: { min: number; max: number; labels: Record<number, string> }; questions: { text: string; skill_code: string | null }[]; disabled: boolean }) {
  const [state, action] = useActionState(saveQuestionnaire.bind(null, versionId), null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Nom de la version" required>{({ id }) => <Input id={id} name="label" defaultValue={label} />}</Field>
      <Field label="Texte d’introduction" optional>{({ id }) => <Textarea id={id} name="intro" rows={2} defaultValue={intro ?? ''} />}</Field>
      <Checkbox name="isProvisional" defaultChecked={isProvisional} label="Questionnaire provisoire" />
      <fieldset disabled={disabled} className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold">Libellés des réponses</p>
          <div className="grid gap-2 sm:grid-cols-5">
            {Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i).map((value) => (
              <Input key={value} name={`scale-${value}`} aria-label={`Libellé de la réponse ${value}`} defaultValue={scale.labels[value] ?? ''} />
            ))}
          </div>
        </div>
        <Field label="Affirmations" hint="Une affirmation par ligne. Ajoutez « | code_competence » pour la rapprocher d’une compétence transversale (ex. … | cooperation).">
          {({ id, describedBy }) => <Textarea id={id} name="questions" rows={14} aria-describedby={describedBy} defaultValue={questions.map((q) => (q.skill_code ? `${q.text} | ${q.skill_code}` : q.text)).join('\n')} />}
        </Field>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Enregistrer</SubmitButton>
    </form>
  );
}

export function PublishQuestionnaireButton({ versionId }: { versionId: string }) {
  const { pending, run } = useRun();
  return (
    <Button loading={pending} onClick={() => run(() => publishQuestionnaire(versionId), 'Questionnaire publié : il est désormais proposé aux nouveaux participants.', 'Publier ce questionnaire ? La version actuelle sera archivée ; les auto-évaluations déjà réalisées sont conservées.')}>
      <Send aria-hidden />
      Publier
    </Button>
  );
}
