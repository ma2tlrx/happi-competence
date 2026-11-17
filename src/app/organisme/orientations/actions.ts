'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, validationError, type ActionState } from '@/lib/action-state';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { referralFormValues, referralRow, referralSchema, STATUS_REASON_MAX } from '@/lib/referrals/fields';
import { createClient } from '@/lib/supabase/server';

async function requirePrescriber() {
  const user = await requireRole('organisme');
  if (!user.organization || user.organization.status !== 'active') return { user, error: 'Votre espace organisme n’est pas actif.' };
  if (!hasPermission(user, 'org.referrals.write')) return { user, error: 'Vous n’êtes pas autorisé à orienter des personnes.' };
  return { user, error: null };
}

/** Envoi d'une fiche d'orientation. Les droits sont revérifiés par la base (RLS et déclencheur). */
export async function createReferral(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, error: denied } = await requirePrescriber();
  if (denied) return actionError(denied);
  const parsed = referralSchema.safeParse(referralFormValues(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from('referrals').insert(referralRow(parsed.data, user.organization!.id)).select('id').single();
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/organisme', 'layout');
  redirect(`/organisme/orientations/${data.id}?envoyee=1`);
}

export async function cancelReferral(referralId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { error: denied } = await requirePrescriber();
  if (denied) return actionError(denied);
  if (!z.string().uuid().safeParse(referralId).success) return actionError('Orientation invalide.');
  const reason = z
    .string()
    .trim()
    .min(3, 'Indiquez le motif de l’annulation.')
    .max(STATUS_REASON_MAX)
    .safeParse(formData.get('reason') ?? '');
  if (!reason.success) return actionError('Certains champs sont à corriger.', { reason: reason.error.issues[0]?.message ?? 'Motif invalide.' });
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_referral', { p_referral_id: referralId, p_reason: reason.data });
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath(`/organisme/orientations/${referralId}`);
  revalidatePath('/organisme/orientations');
  return actionSuccess('L’orientation est annulée. L’équipe HAPPI en est informée.');
}
