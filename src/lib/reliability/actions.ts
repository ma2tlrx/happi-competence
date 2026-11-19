'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import type { Json } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

import { loadReliabilityDataset, loadReliabilitySettings } from './load';
import { buildReliabilityReport, publicSnapshot } from './report';
import { MIN_PAIRS_BOUNDS } from './statistics';

/**
 * Actions de la seconde cotation et de la fiabilité de la mesure. Chaque action vérifie le rôle
 * ici ; la base tranche ensuite (fonctions SECURITY DEFINER : auteur, aveugle, exercice ouvert).
 */

const ADMIN_PATH = '/admin/fiabilite';
const TRAINER_PATH = '/formateur/seconde-cotation';
type Simple = { ok: true; message?: string } | { ok: false; message: string };

// ── Formateur ────────────────────────────────────────────────────────────────
const REASONS: Record<string, string> = {
  not_blind: 'évaluation officielle déjà commencée',
  official_evaluator: 'vous êtes l’auteur de l’évaluation officielle',
  not_member: 'ne fait plus partie du groupe',
  session_trainer: 'vous animez la séance',
  not_trainer: 'compte non formateur',
};

export async function startSecondRating(sessionId: string): Promise<Simple> {
  await requireRole('formateur');
  if (!isUuid(sessionId)) return { ok: false, message: 'Séance introuvable.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_second_rating', { p_session_id: sessionId });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  const result = data as { created: number; existing: number; skipped: { reason: string }[] };
  revalidatePath(TRAINER_PATH, 'layout');
  const skipped = result.skipped.length
    ? ` ${result.skipped.length} participant(s) écarté(s) : ${[...new Set(result.skipped.map((item) => REASONS[item.reason] ?? item.reason))].join(', ')}.`
    : '';
  if (result.created === 0 && result.existing === 0) return { ok: false, message: `Aucune seconde cotation possible pour cette séance.${skipped}` };
  return { ok: true, message: `${result.created} seconde(s) cotation(s) ouverte(s).${skipped}` };
}

const payloadSchema = z.object({
  ratingId: z.string().uuid(),
  scores: z.array(z.object({ skill_id: z.string().uuid(), score: z.number().nullable(), source: z.enum(['direct', 'derived']), comment: z.string().max(1500).nullable() })).max(200),
  criteria: z.record(z.string().uuid(), z.object({ observed: z.boolean().nullable(), score: z.number().nullable() })),
  comment: z.string().max(2000),
});
export type SecondRatingPayload = z.infer<typeof payloadSchema>;

type SaveResult = { ok: true; savedAt: string } | { ok: false; message: string };

export async function saveSecondRating(payload: SecondRatingPayload): Promise<SaveResult> {
  await requireRole('formateur');
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: 'Données de cotation invalides.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('save_second_rating', {
    p_rating_id: parsed.data.ratingId,
    p_scores: parsed.data.scores as unknown as Json,
    p_criteria: parsed.data.criteria as unknown as Json,
    p_comment: parsed.data.comment,
  });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  return { ok: true, savedAt: (data as string | null) ?? new Date().toISOString() };
}

export type Feedback = { validated: boolean; scores: Record<string, number | null> };

/** Soumission (après un dernier enregistrement) ; renvoie le retour de comparaison. */
export async function submitSecondRating(payload: SecondRatingPayload): Promise<{ ok: true; feedback: Feedback | null } | { ok: false; message: string }> {
  const saved = await saveSecondRating(payload);
  if (!saved.ok) return saved;
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_second_rating', { p_rating_id: payload.ratingId });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(TRAINER_PATH, 'layout');
  return { ok: true, feedback: await secondRatingFeedback(payload.ratingId) };
}

export async function secondRatingFeedback(ratingId: string): Promise<Feedback | null> {
  await requireRole('formateur');
  if (!isUuid(ratingId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_second_rating_feedback', { p_rating_id: ratingId });
  if (error || !data || typeof data !== 'object') return null;
  const value = data as { validated?: boolean; scores?: Record<string, number | string | null> };
  return {
    validated: value.validated === true,
    scores: Object.fromEntries(Object.entries(value.scores ?? {}).map(([skillId, score]) => [skillId, score === null ? null : Number(score)])),
  };
}

// ── Administrateur ───────────────────────────────────────────────────────────
async function admin() {
  await requireRole('admin');
  return createClient();
}

export async function saveMinPairs(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await admin();
  const parsed = z.coerce.number().int().min(MIN_PAIRS_BOUNDS.min).max(MIN_PAIRS_BOUNDS.max).safeParse(formData.get('minPairs'));
  if (!parsed.success) return actionError('Seuil invalide.', { minPairs: `Entre ${MIN_PAIRS_BOUNDS.min} et ${MIN_PAIRS_BOUNDS.max} paires.` });
  const { error } = await supabase.from('reliability_settings').update({ min_pairs: parsed.data }).eq('id', true).select('id').single();
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(ADMIN_PATH);
  return actionSuccess('Seuil enregistré.');
}

/** Calcule l'instantané (données réelles uniquement, jamais la démonstration) et le publie. */
export async function publishReliability(): Promise<Simple> {
  const supabase = await admin();
  const settings = await loadReliabilitySettings(supabase);
  const report = buildReliabilityReport(await loadReliabilityDataset(supabase, { includeDemo: false }), settings.minPairs);
  if (report.versions.length === 0) return { ok: false, message: 'Aucune seconde cotation soumise sur des données réelles : rien à publier.' };
  const computedAt = new Date().toISOString();
  const { error } = await supabase
    .from('reliability_settings')
    .update({ publish: true, snapshot: publicSnapshot(report, computedAt) as unknown as Json, computed_at: computedAt })
    .eq('id', true)
    .select('id')
    .single();
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(ADMIN_PATH);
  revalidatePath('/methode');
  return { ok: true, message: 'Statistiques publiées sur la page « Notre méthode ».' };
}

export async function unpublishReliability(): Promise<Simple> {
  const supabase = await admin();
  const { error } = await supabase.from('reliability_settings').update({ publish: false }).eq('id', true).select('id').single();
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(ADMIN_PATH);
  revalidatePath('/methode');
  return { ok: true, message: 'Les statistiques ne sont plus affichées publiquement.' };
}

const exerciseSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().trim().min(3, '3 caractères minimum.').max(160),
  instructions: z.string().trim().max(4000),
  participants: z.array(z.string().uuid()).min(1, 'Choisissez au moins un participant.').max(30),
  raters: z.array(z.string().uuid()).min(1, 'Choisissez au moins un formateur.').max(30),
});

export async function createExercise(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await admin();
  const parsed = exerciseSchema.safeParse({
    sessionId: formData.get('sessionId'),
    title: formData.get('title') ?? '',
    instructions: formData.get('instructions') ?? '',
    participants: formData.getAll('participants'),
    raters: formData.getAll('raters'),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return actionError('Certains champs sont à corriger.', errors);
  }
  const { data, error } = await supabase.rpc('create_calibration_exercise', {
    p_session_id: parsed.data.sessionId,
    p_title: parsed.data.title,
    p_instructions: parsed.data.instructions || null,
    p_participant_ids: parsed.data.participants,
    p_rater_ids: parsed.data.raters,
  });
  if (error) return actionError(databaseErrorMessage(error));
  const result = data as { created: number; skipped: unknown[] };
  revalidatePath(ADMIN_PATH);
  redirect(`${ADMIN_PATH}?exercice=cree&attribuees=${result.created}&ecartees=${result.skipped.length}`);
}

export async function closeExercise(exerciseId: string): Promise<Simple> {
  const supabase = await admin();
  if (!isUuid(exerciseId)) return { ok: false, message: 'Exercice introuvable.' };
  const { error } = await supabase.rpc('close_calibration_exercise', { p_exercise_id: exerciseId });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(ADMIN_PATH);
  return { ok: true, message: 'Exercice clos : les cotations non soumises sont annulées.' };
}
