'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, validationError, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

type Simple = { ok: boolean; message?: string };
const entries = (formData: FormData) => Object.fromEntries([...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : '']));
const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);

async function ctx() {
  await requireRole('admin');
  return createClient();
}
function refresh(versionId: string) {
  revalidatePath(`/admin/referentiels/${versionId}`);
  revalidatePath('/admin/referentiels');
}

// ── Versions ─────────────────────────────────────────────────────────────────
export async function cloneVersion(sourceVersionId: string) {
  const supabase = await ctx();
  const { data, error } = await supabase.rpc('clone_framework_version', { p_source_version_id: sourceVersionId });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath('/admin/referentiels');
  redirect(`/admin/referentiels/${data as string}?nouvelle=1`);
}

const settingsSchema = z
  .object({
    label: z.string().trim().min(2, 'Donnez un nom à la version.').max(160),
    notes: z.string().trim().max(4000).transform((v) => v || null),
    isProvisional: z.string().optional().transform((v) => v === 'on'),
    scaleMin: z.coerce.number().int().min(0).max(10),
    scaleMax: z.coerce.number().int().min(1).max(20),
    scaleStep: z.enum(['1', '0.5']).transform(Number),
    scoringMode: z.enum(['direct', 'criteria_count', 'criteria_average']),
    aggregation: z.enum(['latest', 'mean', 'weighted_mean', 'max']),
    rounding: z.enum(['none', 'half', 'integer']),
  })
  .refine((v) => v.scaleMax > v.scaleMin, { message: 'Le maximum doit dépasser le minimum.', path: ['scaleMax'] });

export async function saveVersionSettings(versionId: string, published: boolean, _: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await ctx();
  const parsed = settingsSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const base = { label: parsed.data.label, notes: parsed.data.notes, is_provisional: parsed.data.isProvisional };
  const { error } = await supabase
    .from('framework_versions')
    .update(
      published
        ? base
        : {
            ...base,
            scale_min: parsed.data.scaleMin,
            scale_max: parsed.data.scaleMax,
            scale_step: parsed.data.scaleStep,
            scoring_mode: parsed.data.scoringMode,
            aggregation: parsed.data.aggregation,
            rounding: parsed.data.rounding,
          },
    )
    .eq('id', versionId);
  if (error) return actionError(databaseErrorMessage(error));
  refresh(versionId);
  return actionSuccess('Paramètres enregistrés.');
}

export async function setVersionStatus(versionId: string, status: 'published' | 'archived'): Promise<Simple> {
  const supabase = await ctx();
  const { error } = await supabase.from('framework_versions').update({ status }).eq('id', versionId);
  refresh(versionId);
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}

export async function deleteDraftVersion(versionId: string) {
  const supabase = await ctx();
  const { error } = await supabase.from('framework_versions').delete().eq('id', versionId).eq('status', 'draft');
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath('/admin/referentiels');
  redirect('/admin/referentiels');
}

// ── Niveaux de l'échelle ─────────────────────────────────────────────────────
export async function saveLevels(versionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await ctx();
  const { data: version } = await supabase.from('framework_versions').select('scale_min, scale_max').eq('id', versionId).single();
  if (!version) return actionError('Version introuvable.');
  const rows = [];
  for (let value = version.scale_min; value <= version.scale_max; value += 1) {
    const label = String(formData.get(`label-${value}`) ?? '').trim();
    if (!label) return actionError(`Donnez un libellé au niveau ${value}.`);
    rows.push({ version_id: versionId, value, label: label.slice(0, 80), description: String(formData.get(`description-${value}`) ?? '').trim().slice(0, 500) || null });
  }
  await supabase.from('scale_levels').delete().eq('version_id', versionId).or(`value.lt.${version.scale_min},value.gt.${version.scale_max}`);
  const { error } = await supabase.from('scale_levels').upsert(rows, { onConflict: 'version_id,value' });
  if (error) return actionError(databaseErrorMessage(error));
  refresh(versionId);
  return actionSuccess('Niveaux enregistrés.');
}

// ── Catégories ───────────────────────────────────────────────────────────────
export async function saveCategory(versionId: string, categoryId: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await ctx();
  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2) return actionError('Indiquez un nom.', { name: 'Indiquez un nom.' });
  const description = String(formData.get('description') ?? '').trim().slice(0, 500) || null;
  const position = Number(formData.get('position') ?? 0) || 0;
  const { error } = categoryId
    ? await supabase.from('skill_categories').update({ name, description, position }).eq('id', categoryId)
    : await supabase.from('skill_categories').insert({ version_id: versionId, name, description, position, code: slug(name) || `categorie_${Date.now()}` });
  if (error) return actionError(databaseErrorMessage(error));
  refresh(versionId);
  return actionSuccess('Catégorie enregistrée.');
}

export async function deleteCategory(versionId: string, categoryId: string): Promise<Simple> {
  const supabase = await ctx();
  const { error } = await supabase.from('skill_categories').delete().eq('id', categoryId);
  refresh(versionId);
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}

// ── Compétences, niveaux décrits et critères ─────────────────────────────────
export async function saveSkill(versionId: string, skillId: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await ctx();
  const data = entries(formData);
  const name = (data.name ?? '').trim();
  if (name.length < 2) return actionError('Indiquez le nom de la compétence.', { name: 'Indiquez le nom de la compétence.' });
  const values = {
    name: name.slice(0, 120),
    description: (data.description ?? '').trim().slice(0, 1000) || null,
    category_id: data.categoryId || null,
    weight: Math.max(0, Number(data.weight) || 1),
    position: Number(data.position) || 0,
    is_active: data.isActive === 'on',
  };
  let id = skillId;
  if (skillId) {
    const { error } = await supabase.from('skills').update(values).eq('id', skillId);
    if (error) return actionError(databaseErrorMessage(error));
  } else {
    const code = slug(data.code || name);
    if (!code) return actionError('Code invalide.');
    const { data: created, error } = await supabase.from('skills').insert({ ...values, version_id: versionId, code }).select('id').single();
    if (error) return actionError(error.code === '23505' ? 'Une compétence porte déjà ce code dans cette version.' : databaseErrorMessage(error));
    id = created.id;
  }

  // Description de chaque niveau
  const descriptors = Object.entries(data)
    .filter(([key, value]) => key.startsWith('level-') && value.trim())
    .map(([key, value]) => ({ skill_id: id!, level_value: Number(key.slice(6)), description: value.trim().slice(0, 600) }));
  await supabase.from('skill_level_descriptors').delete().eq('skill_id', id!);
  if (descriptors.length) {
    const { error } = await supabase.from('skill_level_descriptors').insert(descriptors);
    if (error) return actionError(databaseErrorMessage(error));
  }

  // Critères : une ligne par critère, « libellé | poids » facultatif
  const criteria = (data.criteria ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((line, index) => {
      const [label, weight] = line.split('|').map((part) => part.trim());
      return { skill_id: id!, label: label!.slice(0, 300), weight: Math.max(0, Number(weight) || 1), position: index + 1 };
    });
  await supabase.from('skill_criteria').delete().eq('skill_id', id!);
  if (criteria.length) {
    const { error } = await supabase.from('skill_criteria').insert(criteria);
    if (error) return actionError(databaseErrorMessage(error));
  }
  refresh(versionId);
  return actionSuccess('Compétence enregistrée.');
}

export async function deleteSkill(versionId: string, skillId: string): Promise<Simple> {
  const supabase = await ctx();
  const { error } = await supabase.from('skills').delete().eq('id', skillId);
  refresh(versionId);
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}

// ── Correspondances session ↔ compétence ─────────────────────────────────────
export async function toggleMapping(versionId: string, sessionNumber: number, skillId: string, enabled: boolean): Promise<Simple> {
  const supabase = await ctx();
  const { error } = enabled
    ? await supabase.from('session_skill_map').insert({ version_id: versionId, session_number: sessionNumber, skill_id: skillId })
    : await supabase.from('session_skill_map').delete().eq('version_id', versionId).eq('session_number', sessionNumber).eq('skill_id', skillId);
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}

// ── Questionnaire d'auto-évaluation ──────────────────────────────────────────
export async function cloneQuestionnaire(sourceVersionId: string) {
  const supabase = await ctx();
  const { data, error } = await supabase.rpc('clone_questionnaire_version', { p_source_version_id: sourceVersionId });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath('/admin/referentiels');
  redirect(`/admin/referentiels/questionnaire/${data as string}`);
}

export async function saveQuestionnaire(versionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await ctx();
  const data = entries(formData);
  const label = (data.label ?? '').trim();
  if (label.length < 2) return actionError('Donnez un nom à la version.');
  const { data: version, error: versionError } = await supabase
    .from('questionnaire_versions')
    .update({ label, intro: (data.intro ?? '').trim() || null, is_provisional: data.isProvisional === 'on' })
    .eq('id', versionId)
    .select('scale_min, scale_max, status')
    .single();
  if (versionError) return actionError(databaseErrorMessage(versionError));
  if (version.status !== 'draft') return actionSuccess('Version enregistrée.');

  const scale = [];
  for (let value = version.scale_min; value <= version.scale_max; value += 1) {
    const text = (data[`scale-${value}`] ?? '').trim();
    if (!text) return actionError(`Donnez un libellé à la réponse ${value}.`);
    scale.push({ version_id: versionId, value, label: text.slice(0, 80) });
  }
  const questions = (data.questions ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80)
    .map((line, index) => {
      const [text, skill] = line.split('|').map((part) => part.trim());
      return { version_id: versionId, position: index + 1, text: text!.slice(0, 400), framework_code: skill ? 'transversal' : null, skill_code: skill || null };
    });
  if (questions.length === 0) return actionError('Ajoutez au moins une question.');
  await supabase.from('questionnaire_scale_labels').delete().eq('version_id', versionId);
  await supabase.from('questionnaire_questions').delete().eq('version_id', versionId);
  const [scaleResult, questionResult] = await Promise.all([
    supabase.from('questionnaire_scale_labels').insert(scale),
    supabase.from('questionnaire_questions').insert(questions),
  ]);
  const error = scaleResult.error ?? questionResult.error;
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(`/admin/referentiels/questionnaire/${versionId}`);
  return actionSuccess('Questionnaire enregistré.');
}

export async function publishQuestionnaire(versionId: string): Promise<Simple> {
  const supabase = await ctx();
  const { error } = await supabase.from('questionnaire_versions').update({ status: 'published' }).eq('id', versionId);
  revalidatePath('/admin/referentiels', 'layout');
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}
