'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { parseQuestions } from '@/lib/satisfaction/questions-format';
import { createClient } from '@/lib/supabase/server';

type Simple = { ok: boolean; message?: string };

async function ctx() {
  await requireRole('admin');
  return createClient();
}

export async function cloneSurveyVersion(sourceVersionId: string): Promise<Simple> {
  if (!z.string().uuid().safeParse(sourceVersionId).success) return { ok: false, message: 'Version introuvable.' };
  const supabase = await ctx();
  const { data, error } = await supabase.rpc('clone_satisfaction_version', { p_source_version_id: sourceVersionId });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath('/admin/satisfaction');
  redirect(`/admin/satisfaction/${data as string}`);
}

const settingsSchema = z.object({
  label: z.string().trim().min(2, 'Donnez un nom à la version.').max(160),
  intro: z.string().trim().max(2000).transform((value) => value || null),
  isProvisional: z.string().optional().transform((value) => value === 'on'),
});

export async function saveSurveyVersion(versionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await ctx();
  const settings = settingsSchema.safeParse({ label: formData.get('label') ?? '', intro: formData.get('intro') ?? '', isProvisional: formData.get('isProvisional') ?? undefined });
  if (!settings.success) return actionError(settings.error.issues[0]?.message ?? 'Paramètres invalides.');
  const { data: version } = await supabase.from('satisfaction_survey_versions').select('status').eq('id', versionId).maybeSingle();
  if (!version) return actionError('Version introuvable.');
  if (version.status !== 'draft') return actionError('Cette version est publiée : elle ne se modifie plus. Créez une nouvelle version.');

  const ratingLabels = [1, 2, 3, 4, 5].map((value) => String(formData.get(`rating-${value}`) ?? '').trim().slice(0, 60));
  if (ratingLabels.some((label) => !label)) return actionError('Donnez un libellé à chacun des cinq niveaux de note.');
  const { questions, errors } = parseQuestions(String(formData.get('questions') ?? ''));
  if (errors.length) return actionError(errors.slice(0, 3).join(' '));

  const { error: updateError } = await supabase
    .from('satisfaction_survey_versions')
    .update({ label: settings.data.label, intro: settings.data.intro, is_provisional: settings.data.isProvisional, rating_labels: ratingLabels })
    .eq('id', versionId);
  if (updateError) return actionError(databaseErrorMessage(updateError));
  // Brouillon : aucune réponse ne s'y rattache, les questions sont remplacées en bloc.
  const { error: deleteError } = await supabase.from('satisfaction_questions').delete().eq('version_id', versionId);
  if (deleteError) return actionError(databaseErrorMessage(deleteError));
  const { error } = await supabase.from('satisfaction_questions').insert(
    questions.map((question) => ({
      version_id: versionId,
      position: question.position,
      kind: question.kind,
      text: question.text,
      options: question.options,
      is_required: question.isRequired,
    })),
  );
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(`/admin/satisfaction/${versionId}`);
  revalidatePath('/admin/satisfaction');
  return actionSuccess('Enquête enregistrée.');
}

export async function publishSurveyVersion(versionId: string): Promise<Simple> {
  const supabase = await ctx();
  const { error } = await supabase.from('satisfaction_survey_versions').update({ status: 'published' }).eq('id', versionId).eq('status', 'draft');
  revalidatePath('/admin/satisfaction', 'layout');
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}

export async function deleteSurveyDraft(versionId: string): Promise<Simple> {
  const supabase = await ctx();
  const { error } = await supabase.from('satisfaction_survey_versions').delete().eq('id', versionId).eq('status', 'draft');
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath('/admin/satisfaction');
  redirect('/admin/satisfaction');
}
