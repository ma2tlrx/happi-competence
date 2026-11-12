'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, validationError, type ActionState } from '@/lib/action-state';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Indiquez votre prénom.').max(80),
  lastName: z.string().trim().min(1, 'Indiquez votre nom.').max(80),
  phone: z
    .string()
    .trim()
    .max(30, 'Numéro trop long.')
    .refine((value) => value === '' || /^[+0-9 ().-]{6,}$/.test(value), 'Numéro de téléphone invalide.'),
});

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({ firstName: formData.get('firstName'), lastName: formData.get('lastName'), phone: formData.get('phone') ?? '' });
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ first_name: parsed.data.firstName, last_name: parsed.data.lastName, phone: parsed.data.phone || null })
    .eq('id', user.id);
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/', 'layout');
  return actionSuccess('Vos informations ont été enregistrées.');
}

/**
 * Préférences d'e-mail. Seuls les rappels J-1 sont facultatifs : convocations, modifications et
 * annulations de séance restent envoyées, car elles portent une information indispensable.
 */
export async function updateEmailPreferences(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from('email_preferences')
    .upsert({ user_id: user.id, reminders: formData.get('reminders') === 'on' }, { onConflict: 'user_id' });
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/compte');
  return actionSuccess('Vos préférences d’e-mail ont été enregistrées.');
}

export async function requestDeletion(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (formData.get('confirm') !== 'on') return actionError('Cochez la case pour confirmer votre demande.');
  const supabase = await createClient();
  const { data: pending } = await supabase.from('data_requests').select('id').eq('user_id', user.id).eq('type', 'deletion').eq('status', 'pending').maybeSingle();
  if (pending) return actionError('Une demande de suppression est déjà en cours de traitement.');
  const details = String(formData.get('details') ?? '').trim().slice(0, 2000);
  const { error } = await supabase.from('data_requests').insert({ user_id: user.id, type: 'deletion', details: details || null });
  if (error) return actionError(databaseErrorMessage(error));
  revalidatePath('/compte');
  return actionSuccess('Votre demande a été transmise à l’équipe HAPPI. Vous serez notifié de son traitement.');
}

export async function cancelDeletion(requestId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from('data_requests').update({ status: 'cancelled' }).eq('id', requestId).eq('user_id', user.id).eq('status', 'pending');
  revalidatePath('/compte');
}
