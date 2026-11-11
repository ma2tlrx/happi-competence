'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import type { Json } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';
import { generateReportContent } from '@/lib/report/ai';
import { checkContent, reportContentSchema, reportOptionsSchema, type ReportContent } from '@/lib/report/content';
import { computeReportData, getReport } from '@/lib/report/load';
import { REPORT_ENGINE_VERSION } from '@/lib/report/model';

const uuid = z.string().uuid();

function pathFor(participantId: string) {
  return `/formateur/participants/${participantId}/bilan`;
}

/** Enregistre un texte produit par l'IA sur un brouillon. Les résultats ne sont pas touchés. */
async function writeWithAi(reportId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const report = await getReport(supabase, reportId);
  if (!report) return { ok: false, message: 'Bilan introuvable.' };
  if (report.status !== 'draft') return { ok: false, message: 'Ce bilan est validé : créez une nouvelle version pour le réécrire.' };
  const result = await generateReportContent(report.data, report.options);
  if (!result.ok) {
    const details = result.issues?.length ? ` (${result.issues.slice(0, 3).map((issue) => issue.message).join(' ')})` : '';
    return { ok: false, message: `${result.message}${details}` };
  }
  const { error } = await supabase
    .from('participant_reports')
    .update({
      content: result.content as unknown as Json,
      content_source: 'ai',
      content_model: result.model.slice(0, 80),
      content_generated_at: new Date().toISOString(),
    })
    .eq('id', reportId);
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  return { ok: true, message: 'Texte rédigé. Relisez-le, corrigez-le si besoin, puis validez le bilan.' };
}

/**
 * Crée une nouvelle version du bilan : photographie des résultats actuels, puis
 * rédaction automatique si le service est configuré. Un échec de rédaction laisse
 * un brouillon utilisable (rédaction manuelle ou nouvel essai).
 */
export async function createReport(participantId: string, withAi: boolean): Promise<ActionState<{ reportId: string }>> {
  await requireRole('formateur', 'admin');
  if (!uuid.safeParse(participantId).success) return actionError('Participant introuvable.');
  const supabase = await createClient();
  const data = await computeReportData(supabase, participantId);
  if (!data) return actionError('Participant introuvable.');
  const { data: row, error } = await supabase
    .from('participant_reports')
    .insert({ participant_id: participantId, version: 0, data: data as unknown as Json, engine_version: REPORT_ENGINE_VERSION })
    .select('id, version')
    .single();
  if (error || !row) return actionError(databaseErrorMessage(error));
  revalidatePath(pathFor(participantId));
  if (!withAi || data.counts.observations === 0) {
    return actionSuccess(
      data.counts.observations === 0
        ? `Version ${row.version} créée. Aucune observation validée : le bilan ne peut pas encore être rédigé.`
        : `Version ${row.version} créée. Vous pouvez la rédiger.`,
      { reportId: row.id },
    );
  }
  const written = await writeWithAi(row.id);
  revalidatePath(pathFor(participantId));
  return written.ok
    ? actionSuccess(`Version ${row.version} créée et rédigée. ${written.message}`, { reportId: row.id })
    : { ok: false, message: `Version ${row.version} créée, mais la rédaction automatique a échoué : ${written.message}`, data: { reportId: row.id } };
}

export async function regenerateContent(reportId: string): Promise<ActionState> {
  await requireRole('formateur', 'admin');
  if (!uuid.safeParse(reportId).success) return actionError('Bilan introuvable.');
  const supabase = await createClient();
  const report = await getReport(supabase, reportId);
  if (!report) return actionError('Bilan introuvable.');
  const written = await writeWithAi(reportId);
  revalidatePath(pathFor(report.participantId));
  return written.ok ? actionSuccess(written.message) : actionError(written.message);
}

const saveSchema = z.object({ reportId: uuid, content: z.string().max(400_000), options: z.string().max(20_000) });

/** Enregistre le texte relu ou rédigé à la main, après contrôle de cohérence avec les résultats. */
export async function saveReport(input: { reportId: string; content: ReportContent; options: unknown }): Promise<ActionState> {
  await requireRole('formateur', 'admin');
  const parsed = saveSchema.safeParse({ reportId: input.reportId, content: JSON.stringify(input.content), options: JSON.stringify(input.options) });
  if (!parsed.success) return actionError('Le bilan est trop volumineux pour être enregistré.');
  const content = reportContentSchema.safeParse(input.content);
  const options = reportOptionsSchema.safeParse(input.options);
  if (!content.success) return actionError('Le texte n’a pas le format attendu.');
  if (!options.success) return actionError('Réglages invalides : la structure accompagnatrice et les observations complémentaires sont limitées en longueur.');
  const supabase = await createClient();
  const report = await getReport(supabase, input.reportId);
  if (!report) return actionError('Bilan introuvable.');
  if (report.status !== 'draft') return actionError('Ce bilan est validé : il ne peut plus être modifié.');
  const issues = checkContent(content.data, report.data);
  if (issues.length) {
    return { ok: false, message: 'Certains passages sont à corriger avant enregistrement.', fieldErrors: Object.fromEntries(issues.map((issue) => [issue.path, issue.message])) };
  }
  const changed = JSON.stringify(content.data) !== JSON.stringify(report.content);
  const source = !changed ? report.contentSource : report.contentSource === 'ai' || report.contentSource === 'ai_edited' ? 'ai_edited' : 'manual';
  const { error } = await supabase
    .from('participant_reports')
    .update({ content: content.data as unknown as Json, content_source: source, options: options.data as unknown as Json })
    .eq('id', input.reportId);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(pathFor(report.participantId));
  return actionSuccess('Bilan enregistré.');
}

/** Valide le bilan : il devient visible du participant et de son organisme, et n'est plus modifiable. */
export async function finalizeReport(reportId: string): Promise<ActionState> {
  await requireRole('formateur', 'admin');
  if (!uuid.safeParse(reportId).success) return actionError('Bilan introuvable.');
  const supabase = await createClient();
  const report = await getReport(supabase, reportId);
  if (!report) return actionError('Bilan introuvable.');
  if (!report.content) return actionError('Rédigez le bilan avant de le valider.');
  const missing = [
    !report.content.introduction.trim() && 'l’introduction',
    !report.content.profile.summary.trim() && 'la synthèse du profil',
    !report.content.conclusion.trim() && 'la synthèse finale',
  ].filter(Boolean);
  if (missing.length) return actionError(`Complétez ${missing.join(', ')} avant de valider.`);
  const issues = checkContent(report.content, report.data);
  if (issues.length) return actionError(`Le texte comporte ${issues.length} point(s) à corriger avant validation.`);
  const { error } = await supabase.from('participant_reports').update({ status: 'final' }).eq('id', reportId);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(pathFor(report.participantId));
  return actionSuccess('Bilan validé. Le participant et son organisme peuvent désormais le télécharger.');
}

export async function deleteDraft(reportId: string): Promise<ActionState> {
  await requireRole('formateur', 'admin');
  if (!uuid.safeParse(reportId).success) return actionError('Bilan introuvable.');
  const supabase = await createClient();
  const report = await getReport(supabase, reportId);
  if (!report) return actionError('Bilan introuvable.');
  if (report.status !== 'draft') return actionError('Un bilan validé ne se supprime pas.');
  const { error } = await supabase.from('participant_reports').delete().eq('id', reportId);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(pathFor(report.participantId));
  return actionSuccess(`Brouillon (version ${report.version}) supprimé.`);
}
