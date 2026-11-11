'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, validationError, type ActionState } from '@/lib/action-state';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

const uuid = z.string().uuid();
const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Date invalide.')
  .transform((value) => value || null);
const optionalTime = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d{2}:\d{2}$/.test(value), 'Horaire invalide.')
  .transform((value) => value || null);

const groupSchema = z
  .object({
    name: z.string().trim().min(2, 'Donnez un nom au groupe.').max(120),
    programId: uuid,
    organizationId: z.union([uuid, z.literal('')]).transform((value) => value || null),
    startDate: optionalDate,
    endDate: optionalDate,
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    message: 'La date de fin doit suivre la date de début.',
    path: ['endDate'],
  });

function entries(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : '']));
}

// ── Groupes ──────────────────────────────────────────────────────────────────
export async function createGroup(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole('formateur', 'admin');
  if (!hasPermission(user, 'groups.manage')) return actionError('Vous n’êtes pas autorisé à créer des groupes.');
  const parsed = groupSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('groups')
    .insert({
      name: parsed.data.name,
      program_id: parsed.data.programId,
      organization_id: parsed.data.organizationId,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/formateur', 'layout');
  redirect(`/formateur/groupes/${data.id}?cree=1`);
}

export async function updateGroup(groupId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('formateur', 'admin');
  const parsed = groupSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const status = z.enum(['planned', 'active', 'completed', 'archived']).safeParse(formData.get('status'));
  const supabase = await createClient();
  const { error } = await supabase
    .from('groups')
    .update({
      name: parsed.data.name,
      program_id: parsed.data.programId,
      organization_id: parsed.data.organizationId,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      ...(status.success ? { status: status.data } : {}),
    })
    .eq('id', groupId);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(`/formateur/groupes/${groupId}`);
  return actionSuccess('Le groupe a été mis à jour.');
}

// ── Membres ──────────────────────────────────────────────────────────────────
export async function addMember(groupId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const existing = formData.get('participantId');
  let args: { p_group_id: string; p_participant_id?: string; p_first_name?: string; p_last_name?: string; p_email?: string };
  if (typeof existing === 'string' && existing) {
    if (!uuid.safeParse(existing).success) return actionError('Participant invalide.');
    args = { p_group_id: groupId, p_participant_id: existing };
  } else {
    const parsed = z
      .object({
        firstName: z.string().trim().min(1, 'Indiquez le prénom.').max(80),
        lastName: z.string().trim().min(1, 'Indiquez le nom.').max(80),
        email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.'),
      })
      .safeParse(entries(formData));
    if (!parsed.success) return validationError(parsed.error);
    args = { p_group_id: groupId, p_first_name: parsed.data.firstName, p_last_name: parsed.data.lastName, p_email: parsed.data.email };
  }
  const { data, error } = await supabase.rpc('add_participant_to_group', args);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(`/formateur/groupes/${groupId}`);
  const result = data as { created: boolean; has_account: boolean; other_organization: boolean };
  const notes = [
    result.created ? 'Fiche créée : la personne pourra créer son compte avec cette adresse e-mail.' : null,
    result.other_organization ? 'Attention : ce participant est rattaché à un autre organisme que celui du groupe.' : null,
  ].filter(Boolean);
  return actionSuccess(['Participant ajouté au groupe.', ...notes].join(' '));
}

export async function removeMember(groupId: string, participantId: string) {
  await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const { error } = await supabase.from('group_members').update({ status: 'removed' }).eq('group_id', groupId).eq('participant_id', participantId);
  revalidatePath(`/formateur/groupes/${groupId}`);
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}

export async function restoreMember(groupId: string, participantId: string) {
  await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const { error } = await supabase.from('group_members').update({ status: 'active' }).eq('group_id', groupId).eq('participant_id', participantId);
  revalidatePath(`/formateur/groupes/${groupId}`);
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}

/** Rattachement d'un participant à un organisme (enregistré et historisé en base). */
export async function linkParticipantOrganization(participantId: string, organizationId: string | null, groupId?: string) {
  const user = await requireRole('formateur', 'admin');
  if (!hasPermission(user, 'participants.link_organization')) return { ok: false, message: 'Vous n’êtes pas autorisé à modifier les rattachements.' };
  const supabase = await createClient();
  const { error } = await supabase.from('participants').update({ organization_id: organizationId }).eq('id', participantId);
  if (groupId) revalidatePath(`/formateur/groupes/${groupId}`);
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}

// ── Sessions ─────────────────────────────────────────────────────────────────
/** Crée en une fois les sessions manquantes du programme pour un groupe. */
export async function planSessions(groupId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole('formateur', 'admin');
  if (!hasPermission(user, 'sessions.manage')) return actionError('Vous n’êtes pas autorisé à planifier des sessions.');
  const supabase = await createClient();
  const { data: group } = await supabase.from('groups').select('id, program_id').eq('id', groupId).single();
  if (!group) return actionError('Groupe introuvable.');
  const [{ data: outline }, { data: existing }] = await Promise.all([
    supabase.from('program_sessions').select('id, number').eq('program_id', group.program_id).order('number'),
    supabase.from('sessions').select('program_session_id').eq('group_id', groupId),
  ]);
  const planned = new Set((existing ?? []).map((row) => row.program_session_id));
  const startTime = optionalTime.safeParse(formData.get('startTime') ?? '');
  const endTime = optionalTime.safeParse(formData.get('endTime') ?? '');
  const rawLocation = String(formData.get('location') ?? '').trim();
  const errors: Record<string, string> = {};
  if (!startTime.success) errors.startTime = 'Horaire invalide.';
  if (!endTime.success) errors.endTime = 'Horaire invalide.';
  if (startTime.success && endTime.success && startTime.data && endTime.data && endTime.data <= startTime.data) {
    errors.endTime = 'L’heure de fin doit suivre l’heure de début.';
  }
  if (rawLocation.length > 200) errors.location = 'Le lieu est trop long (200 caractères au plus).';
  if (Object.keys(errors).length) return actionError('Certains champs sont à corriger.', errors);
  const location = rawLocation || null;
  const rows = (outline ?? [])
    .filter((item) => !planned.has(item.id))
    .map((item) => {
      const date = optionalDate.safeParse(formData.get(`date-${item.number}`) ?? '');
      return {
        group_id: groupId,
        program_session_id: item.id,
        number: item.number,
        scheduled_date: date.success ? date.data : null,
        start_time: startTime.success ? startTime.data : null,
        end_time: endTime.success ? endTime.data : null,
        location,
        trainer_id: user.id,
      };
    });
  if (rows.length === 0) return actionError('Toutes les sessions du programme sont déjà créées.');
  const { error } = await supabase.from('sessions').insert(rows);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/formateur/sessions');
  redirect(`/formateur/groupes/${groupId}?planifie=${rows.length}`);
}

const sessionSchema = z
  .object({
    scheduledDate: optionalDate,
    startTime: optionalTime,
    endTime: optionalTime,
    location: z.string().trim().max(200).transform((value) => value || null),
    status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']),
  })
  .refine((value) => !value.startTime || !value.endTime || value.endTime > value.startTime, {
    message: 'L’heure de fin doit suivre l’heure de début.',
    path: ['endTime'],
  });

export async function updateSession(sessionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('formateur', 'admin');
  const parsed = sessionSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from('sessions')
    .update({
      scheduled_date: parsed.data.scheduledDate,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      location: parsed.data.location,
      status: parsed.data.status,
    })
    .eq('id', sessionId);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(`/formateur/sessions/${sessionId}`);
  return actionSuccess('La session a été mise à jour.');
}

export async function setSessionStatus(sessionId: string, status: 'planned' | 'in_progress' | 'completed' | 'cancelled') {
  await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const { error } = await supabase.from('sessions').update({ status }).eq('id', sessionId);
  revalidatePath(`/formateur/sessions/${sessionId}`, 'layout');
  return error ? { ok: false, message: databaseErrorMessage(error) } : { ok: true };
}
