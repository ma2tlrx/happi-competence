'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, databaseErrorMessage, validationError, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

import { attachSchema, conventionSchema, funderSchema } from './schemas';

/**
 * Actions des financements, réservées à l'administrateur : le rôle est vérifié ici, puis la
 * base tranche (RLS administrateur seul, contraintes, déclencheurs d'audit).
 */

type Simple = { ok: boolean; message?: string };
const PATH = '/admin/financements';

function entries(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : '']));
}

async function admin() {
  await requireRole('admin');
  return createClient();
}

function refused(error: { code?: string; message?: string } | null) {
  if (error?.code === 'PGRST116') return actionError('Élément introuvable ou modification non autorisée.');
  if (error?.code === '23505') return actionError('Un financeur de ce type porte déjà ce nom.');
  return actionError(databaseErrorMessage(error));
}

// ── Financeurs ───────────────────────────────────────────────────────────────
export async function saveFunder(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await admin();
  if (id !== null && !isUuid(id)) return actionError('Financeur introuvable.');
  const parsed = funderSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const value = parsed.data;
  const row = { name: value.name, kind: value.kind, contact_name: value.contactName, contact_email: value.contactEmail, contact_phone: value.contactPhone };
  const { error } = id
    ? await supabase.from('funders').update(row).eq('id', id).select('id').single()
    : await supabase.from('funders').insert(row).select('id').single();
  if (error) return refused(error);
  revalidatePath(PATH, 'layout');
  return actionSuccess(id ? 'Financeur mis à jour.' : 'Financeur enregistré.');
}

export async function deleteFunder(id: string): Promise<Simple> {
  const supabase = await admin();
  if (!isUuid(id)) return { ok: false, message: 'Financeur introuvable.' };
  const { error } = await supabase.from('funders').delete().eq('id', id);
  if (error) {
    return { ok: false, message: error.code === '23503' ? 'Ce financeur a des conventions : supprimez-les ou changez leur financeur d’abord.' : databaseErrorMessage(error) };
  }
  revalidatePath(PATH, 'layout');
  return { ok: true };
}

// ── Conventions ──────────────────────────────────────────────────────────────
export async function saveConvention(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await admin();
  if (id !== null && !isUuid(id)) return actionError('Convention introuvable.');
  const parsed = conventionSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const value = parsed.data;
  const row = {
    funder_id: value.funderId,
    reference: value.reference,
    title: value.title,
    start_date: value.startDate,
    end_date: value.endDate,
    planned_participants: value.plannedParticipants,
    planned_hours_per_participant: value.plannedHours,
    amount_eur: value.amount,
    status: value.status,
    notes: value.notes,
  };
  const { data, error } = id
    ? await supabase.from('funding_conventions').update(row).eq('id', id).select('id').single()
    : await supabase.from('funding_conventions').insert(row).select('id').single();
  if (error || !data) return refused(error);
  revalidatePath(PATH, 'layout');
  return actionSuccess(id ? 'Convention mise à jour.' : 'Convention créée : ouvrez-la pour y rattacher ses groupes.');
}

export async function deleteConvention(id: string): Promise<Simple> {
  const supabase = await admin();
  if (!isUuid(id)) return { ok: false, message: 'Convention introuvable.' };
  const { error } = await supabase.from('funding_conventions').delete().eq('id', id);
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(PATH, 'layout');
  return { ok: true };
}

// ── Groupes rattachés ────────────────────────────────────────────────────────
export async function attachGroup(conventionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await admin();
  if (!isUuid(conventionId)) return actionError('Convention introuvable.');
  const parsed = attachSchema.safeParse(entries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { error } = await supabase.from('funding_convention_groups').insert({ convention_id: conventionId, group_id: parsed.data.groupId }).select('group_id').single();
  if (error) {
    return actionError(error.code === '23505' ? 'Ce groupe est déjà rattaché à une convention : détachez-le d’abord.' : databaseErrorMessage(error));
  }
  revalidatePath(PATH, 'layout');
  return actionSuccess('Groupe rattaché.');
}

export async function detachGroup(conventionId: string, groupId: string): Promise<Simple> {
  const supabase = await admin();
  if (!isUuid(conventionId) || !isUuid(groupId)) return { ok: false, message: 'Groupe introuvable.' };
  const { error } = await supabase.from('funding_convention_groups').delete().eq('convention_id', conventionId).eq('group_id', groupId);
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(PATH, 'layout');
  return { ok: true };
}
