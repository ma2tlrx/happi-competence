'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { databaseErrorMessage } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

const payloadSchema = z.object({
  sessionId: z.string().uuid(),
  participantId: z.string().uuid(),
  scores: z.array(z.object({ skill_id: z.string().uuid(), score: z.number().nullable(), source: z.enum(['direct', 'derived']), comment: z.string().max(1500).nullable() })).max(200),
  criteria: z.array(z.object({ criterion_id: z.string().uuid(), observed: z.boolean().nullable(), score: z.number().nullable() })).max(1000),
  comments: z.object({ observation: z.string().max(4000), advice: z.string().max(4000), private: z.string().max(4000) }),
});
export type EvaluationPayload = z.infer<typeof payloadSchema>;

type Result = { ok: true; evaluationId: string; savedAt: string } | { ok: false; message: string };

/** Sauvegarde automatique du brouillon. */
export async function saveDraft(payload: EvaluationPayload): Promise<Result> {
  await requireRole('formateur', 'admin');
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: 'Données d’évaluation invalides.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('save_evaluation_draft', {
    p_session_id: parsed.data.sessionId,
    p_participant_id: parsed.data.participantId,
    p_scores: parsed.data.scores,
    p_criteria: parsed.data.criteria,
    p_comments: parsed.data.comments,
  });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  return { ok: true, evaluationId: data as string, savedAt: new Date().toISOString() };
}

/** Validation explicite : enregistre le dernier état puis fige l'évaluation. */
export async function validateEvaluation(payload: EvaluationPayload): Promise<Result> {
  const saved = await saveDraft(payload);
  if (!saved.ok) return saved;
  const supabase = await createClient();
  const { error } = await supabase.rpc('validate_evaluation', { p_evaluation_id: saved.evaluationId });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(`/formateur/sessions/${payload.sessionId}`, 'layout');
  return saved;
}

/** Modification d'une évaluation validée : motif obligatoire, chaque changement est historisé. */
export async function amendEvaluation(evaluationId: string, reason: string, payload: EvaluationPayload): Promise<Result & { changes?: number }> {
  await requireRole('formateur', 'admin');
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success || !z.string().uuid().safeParse(evaluationId).success) return { ok: false, message: 'Données invalides.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('amend_evaluation', {
    p_evaluation_id: evaluationId,
    p_reason: reason,
    p_scores: parsed.data.scores,
    p_criteria: parsed.data.criteria,
    p_comments: parsed.data.comments,
  });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(`/formateur/sessions/${payload.sessionId}`, 'layout');
  return { ok: true, evaluationId, savedAt: new Date().toISOString(), changes: data as number };
}
