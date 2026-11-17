'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, type ActionState } from '@/lib/action-state';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { notifyParticipantInvited, notifyReferralUpdate, notifySessionsPlanned } from '@/lib/email/events';
import { parisLocalToIso } from '@/lib/referrals/dates';
import { STATUS_REASON_MAX } from '@/lib/referrals/fields';
import { createClient } from '@/lib/supabase/server';

const uuid = z.string().uuid();

async function requireReferralManager() {
  const user = await requireRole('formateur', 'admin');
  return { user, allowed: hasPermission(user, 'referrals.manage') };
}

function revalidateReferral(referralId: string, groupId?: string) {
  for (const base of ['/formateur/orientations', '/admin/orientations']) {
    revalidatePath(base);
    revalidatePath(`${base}/${referralId}`);
  }
  if (groupId) revalidatePath(`/formateur/groupes/${groupId}`);
}

const statusSchema = z
  .object({
    status: z.enum(['received', 'interview_scheduled', 'waitlisted', 'refused']),
    reason: z.string().trim().max(STATUS_REASON_MAX, `${STATUS_REASON_MAX} caractères au maximum.`),
    interviewAt: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.status === 'refused' && value.reason.length < 3) context.addIssue({ code: 'custom', path: ['reason'], message: 'Indiquez le motif du refus.' });
    if (value.status === 'interview_scheduled' && value.interviewAt && !parisLocalToIso(value.interviewAt)) {
      context.addIssue({ code: 'custom', path: ['interviewAt'], message: 'Date et heure invalides.' });
    }
  });

export async function updateReferralStatus(referralId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, allowed } = await requireReferralManager();
  if (!allowed) return actionError('Vous n’êtes pas autorisé à traiter les orientations.');
  if (!uuid.safeParse(referralId).success) return actionError('Orientation invalide.');
  const parsed = statusSchema.safeParse({
    status: formData.get('status'),
    reason: formData.get('reason') ?? '',
    interviewAt: formData.get('interviewAt') ?? '',
  });
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? '_'), issue.message]));
    return actionError('Certains champs sont à corriger.', fieldErrors);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_referral_status', {
    p_referral_id: referralId,
    p_status: parsed.data.status,
    ...(parsed.data.status === 'refused' ? { p_reason: parsed.data.reason } : {}),
    ...(parsed.data.status === 'interview_scheduled' && parsed.data.interviewAt ? { p_interview_at: parisLocalToIso(parsed.data.interviewAt)! } : {}),
  });
  if (error) return actionError(databaseErrorMessage(error));
  await notifyReferralUpdate(referralId, user.id);
  revalidateReferral(referralId);
  return actionSuccess('Statut mis à jour. Le prescripteur est prévenu.');
}

type AssignResult = { participant_id: string; created: boolean; has_account: boolean; attached_to_prescriber: boolean; other_organization: boolean };

async function assign(referralId: string, groupId: string) {
  const { user, allowed } = await requireReferralManager();
  if (!allowed || !hasPermission(user, 'groups.manage')) return { ok: false, message: 'Vous n’êtes pas autorisé à affecter des personnes à un groupe.' };
  if (!uuid.safeParse(referralId).success || !uuid.safeParse(groupId).success) return { ok: false, message: 'Données invalides.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('assign_referral_to_group', { p_referral_id: referralId, p_group_id: groupId });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  const result = data as unknown as AssignResult;
  // Mêmes suites qu'un ajout manuel : invitation à créer son compte, convocations aux séances planifiées.
  if (!result.has_account) await notifyParticipantInvited(result.participant_id, groupId, user.id);
  await notifySessionsPlanned({ groupId }, user.id);
  await notifyReferralUpdate(referralId, user.id);
  revalidateReferral(referralId, groupId);
  const notes = [
    result.created ? 'Fiche participant créée : la personne reçoit une invitation à créer son compte.' : 'La fiche participant existante a été ajoutée au groupe.',
    result.attached_to_prescriber ? 'Elle est rattachée à l’organisme prescripteur.' : null,
    result.other_organization ? 'Attention : cette personne est déjà rattachée à un autre organisme (rattachement conservé).' : null,
  ].filter(Boolean);
  return { ok: true, message: ['Personne affectée au groupe.', ...notes].join(' ') };
}

export async function assignReferral(referralId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = formData.get('groupId');
  if (typeof groupId !== 'string' || !groupId) return actionError('Choisissez un groupe.', { groupId: 'Choisissez un groupe.' });
  const result = await assign(referralId, groupId);
  return result.ok ? actionSuccess(result.message) : actionError(result.message);
}

/** Depuis la page d'un groupe : affecter une personne de la liste d'attente. */
export async function assignReferralToGroup(referralId: string, groupId: string) {
  return assign(referralId, groupId);
}

/** Nombre de places proposées (administrateur ; vérifié aussi par la base). */
export async function updateGroupCapacity(groupId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  if (!uuid.safeParse(groupId).success) return actionError('Groupe invalide.');
  const raw = String(formData.get('capacity') ?? '').trim();
  const capacity = raw === '' ? null : Number(raw);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)) {
    return actionError('Certains champs sont à corriger.', { capacity: 'Indiquez un nombre entier entre 1 et 100, ou laissez vide.' });
  }
  const supabase = await createClient();
  const { error } = await supabase.from('groups').update({ capacity }).eq('id', groupId);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(`/formateur/groupes/${groupId}`);
  return actionSuccess(capacity === null ? 'Nombre de places : taille maximale du programme.' : `Nombre de places fixé à ${capacity}.`);
}
