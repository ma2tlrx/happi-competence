'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { actionError, databaseErrorMessage, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

/** Ouvre (ou reprend) l'auto-évaluation initiale du participant connecté. */
export async function startSelfAssessment(): Promise<{ id: string } | { error: string }> {
  const user = await requireRole('participant');
  if (!user.participantId) return { error: 'Votre fiche participant n’est pas encore disponible.' };
  const supabase = await createClient();
  const { data: existing } = await supabase.from('self_assessments').select('id').eq('participant_id', user.participantId).eq('kind', 'initial').maybeSingle();
  if (existing) return { id: existing.id };
  const { data: version } = await supabase.from('questionnaire_versions').select('id').eq('status', 'published').limit(1).maybeSingle();
  if (!version) return { error: 'Aucun questionnaire n’est ouvert pour le moment.' };
  const { data, error } = await supabase
    .from('self_assessments')
    .insert({ participant_id: user.participantId, questionnaire_version_id: version.id, kind: 'initial' })
    .select('id')
    .single();
  if (error) return { error: databaseErrorMessage(error) };
  return { id: data.id };
}

/**
 * Ouvre (ou reprend) l'auto-évaluation finale : même version de questionnaire que l'initiale,
 * une seule fois. L'ouverture (fin de parcours) est vérifiée par la base.
 */
export async function startFinalSelfAssessment(): Promise<{ id: string } | { error: string }> {
  const user = await requireRole('participant');
  if (!user.participantId) return { error: 'Votre fiche participant n’est pas encore disponible.' };
  const supabase = await createClient();
  const { data: existing } = await supabase.from('self_assessments').select('id').eq('participant_id', user.participantId).eq('kind', 'final').maybeSingle();
  if (existing) return { id: existing.id };
  const { data: initial } = await supabase
    .from('self_assessments')
    .select('questionnaire_version_id')
    .eq('participant_id', user.participantId)
    .eq('kind', 'initial')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!initial) return { error: 'L’auto-évaluation de fin de parcours s’ouvre après l’auto-évaluation de départ.' };
  const { data: open } = await supabase.rpc('my_final_self_assessment_open');
  if (!open) return { error: 'L’auto-évaluation de fin de parcours s’ouvrira à la fin de votre parcours.' };
  const { data, error } = await supabase
    .from('self_assessments')
    .insert({ participant_id: user.participantId, questionnaire_version_id: initial.questionnaire_version_id, kind: 'final' })
    .select('id')
    .single();
  if (error) return { error: databaseErrorMessage(error) };
  return { id: data.id };
}

const answerSchema = z.object({ assessmentId: z.string().uuid(), questionId: z.string().uuid(), value: z.number().int().min(0).max(10) });

/** Enregistre une réponse dès qu'elle est choisie (sauvegarde automatique). */
export async function saveAnswer(input: { assessmentId: string; questionId: string; value: number }): Promise<{ ok: boolean; message?: string }> {
  await requireRole('participant');
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Réponse invalide.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('self_assessment_answers')
    .upsert({ self_assessment_id: parsed.data.assessmentId, question_id: parsed.data.questionId, value: parsed.data.value }, { onConflict: 'self_assessment_id,question_id' });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  return { ok: true };
}

export async function completeSelfAssessment(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('participant');
  const id = z.string().uuid().safeParse(formData.get('assessmentId'));
  if (!id.success) return actionError('Auto-évaluation introuvable.');
  const comment = String(formData.get('comment') ?? '').trim().slice(0, 2000);
  const supabase = await createClient();
  // Les réponses sont renvoyées avec la validation : aucune ne peut manquer, même si une
  // sauvegarde automatique était encore en cours au moment du clic.
  const answers = z
    .record(z.string().uuid(), z.number().int().min(0).max(10))
    .safeParse(JSON.parse(String(formData.get('answers') ?? '{}') || '{}'));
  if (answers.success && Object.keys(answers.data).length > 0) {
    const { error: answersError } = await supabase.from('self_assessment_answers').upsert(
      Object.entries(answers.data).map(([questionId, value]) => ({ self_assessment_id: id.data, question_id: questionId, value })),
      { onConflict: 'self_assessment_id,question_id' },
    );
    if (answersError) return actionError(databaseErrorMessage(answersError));
  }
  const { data: completed, error } = await supabase
    .from('self_assessments')
    .update({ status: 'completed', comment: comment || null })
    .eq('id', id.data)
    .select('kind')
    .maybeSingle();
  if (error) return actionError(databaseErrorMessage(error));
  if (!completed) return actionError('Auto-évaluation introuvable.');
  revalidatePath('/participant', 'layout');
  redirect(completed.kind === 'final' ? '/participant/evolution?terminee=1' : '/participant/dashboard?bienvenue=1');
}
