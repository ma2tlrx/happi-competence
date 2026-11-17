'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, validationError, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import type { Json } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';
import { isUuid } from '@/lib/utils';

import { publicIndicators } from './indicators';
import { loadQualityDashboard } from './load';
import { complaintSchema, improvementActionSchema, needsAssessmentSchema, periodSchema, qualificationSchema, reportSchema, watchEntrySchema } from './schemas';

/**
 * Actions du module qualité. Chaque action vérifie le rôle ici, puis la base tranche (RLS,
 * contraintes, déclencheurs d'audit). Une mise à jour refusée par RLS ne renvoie aucune ligne.
 */

type Simple = { ok: boolean; message?: string };

function entries(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : '']));
}

async function admin() {
  const user = await requireRole('admin');
  return { user, supabase: await createClient() };
}

function refused(error: { code?: string; message?: string } | null) {
  return actionError(error?.code === 'PGRST116' ? 'Élément introuvable ou modification non autorisée.' : databaseErrorMessage(error));
}

const QUALITY_PATH = '/admin/qualite';

// ── Réclamations ─────────────────────────────────────────────────────────────
export async function saveComplaint(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  if (id !== null && !isUuid(id)) return actionError('Réclamation introuvable.');
  const parsed = complaintSchema(todayIso()).safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const value = parsed.data;
  const row = {
    source: value.source,
    channel: value.channel,
    received_on: value.receivedOn,
    subject: value.subject,
    description: value.description,
    reporter_name: value.reporterName,
    status: value.status,
    response: value.response,
    responded_on: value.respondedOn,
  };
  const { error } = id
    ? await supabase.from('quality_complaints').update(row).eq('id', id).select('id').single()
    : await supabase.from('quality_complaints').insert(row).select('id').single();
  if (error) return refused(error);
  revalidatePath(QUALITY_PATH, 'layout');
  return actionSuccess(id ? 'Réclamation mise à jour.' : 'Réclamation enregistrée.');
}

export async function deleteComplaint(id: string): Promise<Simple> {
  const { supabase } = await admin();
  if (!isUuid(id)) return { ok: false, message: 'Réclamation introuvable.' };
  const { error } = await supabase.from('quality_complaints').delete().eq('id', id);
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(QUALITY_PATH, 'layout');
  return { ok: true };
}

/** « Signaler un problème » depuis l'espace participant ou organisme. */
export async function reportProblem(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole('participant', 'organisme');
  if (user.role === 'organisme' && user.organization?.status !== 'active') return actionError('Votre structure n’est pas encore active.');
  const parsed = reportSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_quality_complaint', { p_subject: parsed.data.subject, p_description: parsed.data.description });
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(`/${user.role}/signalements`);
  return actionSuccess('Merci : votre signalement a bien été transmis à l’équipe HAPPI. La réponse apparaîtra ici.');
}

// ── Plan d'amélioration ──────────────────────────────────────────────────────
export async function saveImprovementAction(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  if (id !== null && !isUuid(id)) return actionError('Action introuvable.');
  const parsed = improvementActionSchema().safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const value = parsed.data;
  const row = {
    origin: value.origin,
    origin_details: value.originDetails,
    complaint_id: value.complaintId,
    watch_entry_id: value.watchEntryId,
    title: value.title,
    description: value.description,
    owner_name: value.ownerName,
    due_on: value.dueOn,
    status: value.status,
    effectiveness: value.effectiveness,
  };
  const { error } = id
    ? await supabase.from('quality_improvement_actions').update(row).eq('id', id).select('id').single()
    : await supabase.from('quality_improvement_actions').insert(row).select('id').single();
  if (error) return refused(error);
  revalidatePath(QUALITY_PATH, 'layout');
  return actionSuccess(id ? 'Action mise à jour.' : 'Action ajoutée au plan d’amélioration.');
}

export async function deleteImprovementAction(id: string): Promise<Simple> {
  const { supabase } = await admin();
  if (!isUuid(id)) return { ok: false, message: 'Action introuvable.' };
  const { error } = await supabase.from('quality_improvement_actions').delete().eq('id', id);
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(QUALITY_PATH, 'layout');
  return { ok: true };
}

// ── Veille ───────────────────────────────────────────────────────────────────
export async function saveWatchEntry(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  if (id !== null && !isUuid(id)) return actionError('Entrée introuvable.');
  const parsed = watchEntrySchema(todayIso()).safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const value = parsed.data;
  const row = { kind: value.kind, source: value.source, observed_on: value.observedOn, summary: value.summary, impact: value.impact, decision: value.decision };
  const { error } = id
    ? await supabase.from('quality_watch_entries').update(row).eq('id', id).select('id').single()
    : await supabase.from('quality_watch_entries').insert(row).select('id').single();
  if (error) return refused(error);
  revalidatePath(QUALITY_PATH, 'layout');
  return actionSuccess(id ? 'Entrée de veille mise à jour.' : 'Entrée de veille enregistrée.');
}

export async function deleteWatchEntry(id: string): Promise<Simple> {
  const { supabase } = await admin();
  if (!isUuid(id)) return { ok: false, message: 'Entrée introuvable.' };
  const { error } = await supabase.from('quality_watch_entries').delete().eq('id', id);
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(QUALITY_PATH, 'layout');
  return { ok: true };
}

// ── Registre des intervenants ────────────────────────────────────────────────
/**
 * Ligne du registre : l'administrateur pour tout formateur, le formateur pour lui-même
 * seulement (le formateur cible est imposé côté serveur, puis vérifié par RLS).
 */
export async function saveQualification(trainerId: string, id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole('formateur', 'admin');
  if (!isUuid(trainerId) || (id !== null && !isUuid(id))) return actionError('Ligne introuvable.');
  if (user.role !== 'admin' && trainerId !== user.id) return actionError('Vous ne pouvez compléter que votre propre registre.');
  const parsed = qualificationSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const value = parsed.data;
  const row = {
    kind: value.kind,
    title: value.title,
    provider: value.provider,
    description: value.description,
    started_on: value.startedOn,
    completed_on: value.completedOn,
    is_ai_training: value.isAiTraining,
    evidence: value.evidence,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('trainer_qualifications').update(row).eq('id', id).eq('trainer_id', trainerId).select('id').single()
    : await supabase.from('trainer_qualifications').insert({ ...row, trainer_id: trainerId }).select('id').single();
  if (error) return refused(error);
  revalidatePath(`${QUALITY_PATH}/intervenants`);
  revalidatePath('/formateur/registre');
  return actionSuccess(id ? 'Ligne mise à jour.' : 'Ligne ajoutée au registre.');
}

export async function deleteQualification(id: string): Promise<Simple> {
  const user = await requireRole('formateur', 'admin');
  if (!isUuid(id)) return { ok: false, message: 'Ligne introuvable.' };
  const supabase = await createClient();
  let query = supabase.from('trainer_qualifications').delete().eq('id', id);
  if (user.role !== 'admin') query = query.eq('trainer_id', user.id);
  const { data, error } = await query.select('id');
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  if (!data?.length) return { ok: false, message: 'Ligne introuvable ou suppression non autorisée.' };
  revalidatePath(`${QUALITY_PATH}/intervenants`);
  revalidatePath('/formateur/registre');
  return { ok: true };
}

const thresholdSchema = z.coerce.number().int('Nombre entier attendu.').min(1, 'Au moins 1 mois.').max(120, 'Au plus 120 mois.');

export async function saveTrainingThreshold(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const parsed = thresholdSchema.safeParse(formData.get('months'));
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'Valeur invalide.', { months: parsed.error.issues[0]?.message ?? 'Valeur invalide.' });
  const { error } = await supabase.from('app_settings').upsert({ key: 'quality.training_max_age_months', value: parsed.data, is_public: false });
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(QUALITY_PATH, 'layout');
  return actionSuccess('Seuil enregistré.');
}

// ── Analyse du besoin ────────────────────────────────────────────────────────
export async function saveNeedsAssessment(participantId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole('formateur', 'admin', 'organisme');
  if (user.role === 'organisme' && user.organization?.status !== 'active') return actionError('Votre structure n’est pas encore active.');
  if (!isUuid(participantId)) return actionError('Participant introuvable.');
  const parsed = needsAssessmentSchema(todayIso()).safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const value = parsed.data;
  const row = {
    assessed_on: value.assessedOn,
    expectations: value.expectations,
    constraints_notes: value.constraintsNotes,
    prerequisites: value.prerequisites,
    prerequisites_met: value.prerequisitesMet,
    adaptation_needed: value.adaptationNeeded,
    adaptation_planned: value.adaptationPlanned,
    disability_referent: value.disabilityReferent,
  };
  const supabase = await createClient();
  const { data: existing } = await supabase.from('participant_needs_assessments').select('id').eq('participant_id', participantId).maybeSingle();
  const { error } = existing
    ? await supabase.from('participant_needs_assessments').update(row).eq('id', existing.id).select('id').single()
    : await supabase.from('participant_needs_assessments').insert({ ...row, participant_id: participantId }).select('id').single();
  if (error) return refused(error);
  revalidatePath(`/formateur/participants/${participantId}`);
  revalidatePath(`/organisme/participants/${participantId}`);
  return actionSuccess('Analyse du besoin enregistrée.');
}

// ── Résultats publiés ────────────────────────────────────────────────────────
/** Calcule les indicateurs de la période et publie l'instantané (effectifs ≥ 10 seulement). */
export async function publishPublicResults(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const parsed = periodSchema.safeParse({ from: formData.get('from'), to: formData.get('to') });
  if (!parsed.success) return validationError(parsed.error);
  const today = todayIso();
  const period = { from: parsed.data.from, to: parsed.data.to > today ? today : parsed.data.to };
  const dashboard = await loadQualityDashboard(supabase, period, today);
  const indicators = publicIndicators(dashboard.snapshot);
  const { error } = await supabase
    .from('quality_public_results')
    .update({ enabled: true, period_from: period.from, period_to: period.to, indicators: indicators as unknown as Json, computed_at: new Date().toISOString() })
    .eq('id', true)
    .select('id')
    .single();
  if (error) return refused(error);
  revalidatePath('/', 'layout');
  return actionSuccess('Résultats publiés sur la page « Nos résultats ».');
}

export async function disablePublicResults(): Promise<Simple> {
  const { supabase } = await admin();
  const { error } = await supabase.from('quality_public_results').update({ enabled: false }).eq('id', true);
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath('/', 'layout');
  return { ok: true };
}
