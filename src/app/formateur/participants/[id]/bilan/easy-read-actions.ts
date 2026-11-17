'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { AI_QUOTA_MESSAGE, aiQuotaReached } from '@/lib/ai/quota';
import { actionError, actionSuccess, databaseErrorMessage, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { checkEasyRead, easyReadSchema, type EasyReadContent } from '@/lib/report/easy-read';
import { generateEasyRead } from '@/lib/report/easy-read-ai';
import { getEasyRead, getReport } from '@/lib/report/load';
import type { Json } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';

const uuid = z.string().uuid();
const pathFor = (participantId: string) => `/formateur/participants/${participantId}/bilan`;

/** Bilan validé et rédigé, base obligatoire de la version facile à lire (lecture sous RLS). */
async function finalReport(reportId: string) {
  if (!uuid.safeParse(reportId).success) return { error: 'Bilan introuvable.' } as const;
  const supabase = await createClient();
  const report = await getReport(supabase, reportId);
  if (!report) return { error: 'Bilan introuvable.' } as const;
  if (report.status !== 'final' || !report.content) return { error: 'La version facile à lire se prépare à partir d’un bilan validé.' } as const;
  return { supabase, report } as const;
}

/** Propose une version facile à lire avec l'IA : nouveau brouillon, à relire et valider. */
export async function generateEasyReadDraft(reportId: string): Promise<ActionState> {
  const user = await requireRole('formateur', 'admin');
  const loaded = await finalReport(reportId);
  if ('error' in loaded) return actionError(loaded.error ?? 'Bilan introuvable.');
  if (await aiQuotaReached(user.id)) return actionError(AI_QUOTA_MESSAGE);
  const result = await generateEasyRead(loaded.report.data, loaded.report.content!);
  if (!result.ok) {
    const details = result.issues?.length ? ` (${result.issues.slice(0, 3).map((issue) => issue.message).join(' ')})` : '';
    return actionError(`${result.message}${details}`);
  }
  const { error } = await loaded.supabase.from('participant_report_easy_reads').insert({
    report_id: reportId,
    participant_id: loaded.report.participantId,
    content: result.content as unknown as Json,
    content_source: 'ai',
    content_model: result.model.slice(0, 80),
  });
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(pathFor(loaded.report.participantId));
  return actionSuccess('Version facile à lire proposée. Relisez-la, corrigez-la si besoin, puis validez-la pour la rendre visible.');
}

/** Brouillon vide, pour une rédaction à la main. */
export async function createManualEasyRead(reportId: string): Promise<ActionState> {
  await requireRole('formateur', 'admin');
  const loaded = await finalReport(reportId);
  if ('error' in loaded) return actionError(loaded.error ?? 'Bilan introuvable.');
  const content: EasyReadContent = { sections: [{ title: 'Ce qu’est ce bilan', sentences: [] }] };
  const { error } = await loaded.supabase
    .from('participant_report_easy_reads')
    .insert({ report_id: reportId, participant_id: loaded.report.participantId, content: content as unknown as Json, content_source: 'manual' });
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(pathFor(loaded.report.participantId));
  return actionSuccess('Brouillon créé.');
}

async function draftWithReport(easyReadId: string) {
  if (!uuid.safeParse(easyReadId).success) return { error: 'Version introuvable.' } as const;
  const supabase = await createClient();
  const easyRead = await getEasyRead(supabase, easyReadId);
  if (!easyRead) return { error: 'Version introuvable.' } as const;
  if (easyRead.status !== 'draft') return { error: 'Cette version est validée : elle ne se modifie plus.' } as const;
  const report = await getReport(supabase, easyRead.reportId);
  if (!report) return { error: 'Bilan introuvable.' } as const;
  return { supabase, easyRead, report } as const;
}

/** Enregistre la relecture, après les mêmes contrôles que pour le texte du bilan. */
export async function saveEasyRead(input: { easyReadId: string; content: EasyReadContent }): Promise<ActionState> {
  await requireRole('formateur', 'admin');
  if (JSON.stringify(input.content ?? null).length > 40_000) return actionError('Le texte est trop long.');
  const content = easyReadSchema.safeParse(input.content);
  if (!content.success) return actionError('Le texte n’a pas le format attendu.');
  const loaded = await draftWithReport(input.easyReadId);
  if ('error' in loaded) return actionError(loaded.error ?? 'Version introuvable.');
  const issues = checkEasyRead(content.data, loaded.report.data);
  if (issues.length) return { ok: false, message: 'Certains passages sont à corriger avant enregistrement.', fieldErrors: Object.fromEntries(issues.map((issue) => [issue.path, issue.message])) };
  const changed = JSON.stringify(content.data) !== JSON.stringify(loaded.easyRead.content);
  const source = !changed ? loaded.easyRead.contentSource : loaded.easyRead.contentSource === 'manual' ? 'manual' : 'ai_edited';
  const { error } = await loaded.supabase
    .from('participant_report_easy_reads')
    .update({ content: content.data as unknown as Json, content_source: source })
    .eq('id', input.easyReadId);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(pathFor(loaded.report.participantId));
  return actionSuccess('Version facile à lire enregistrée.');
}

/** Valide la version : elle devient visible du participant (et de son organisme) et figure en dernière section du PDF. */
export async function validateEasyRead(easyReadId: string): Promise<ActionState> {
  await requireRole('formateur', 'admin');
  const loaded = await draftWithReport(easyReadId);
  if ('error' in loaded) return actionError(loaded.error ?? 'Version introuvable.');
  if (!loaded.easyRead.content) return actionError('Texte illisible : enregistrez-le à nouveau.');
  const issues = checkEasyRead(loaded.easyRead.content, loaded.report.data);
  if (issues.length) return actionError(`Le texte comporte ${issues.length} point(s) à corriger avant validation.`);
  const { error } = await loaded.supabase.from('participant_report_easy_reads').update({ status: 'validated' }).eq('id', easyReadId);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(pathFor(loaded.report.participantId));
  return actionSuccess('Version facile à lire validée : le participant peut la lire et l’écouter, et elle figure à la fin du PDF du bilan.');
}

export async function deleteEasyReadDraft(easyReadId: string): Promise<ActionState> {
  await requireRole('formateur', 'admin');
  const loaded = await draftWithReport(easyReadId);
  if ('error' in loaded) return actionError(loaded.error ?? 'Version introuvable.');
  const { error } = await loaded.supabase.from('participant_report_easy_reads').delete().eq('id', easyReadId);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(pathFor(loaded.report.participantId));
  return actionSuccess('Brouillon supprimé.');
}
