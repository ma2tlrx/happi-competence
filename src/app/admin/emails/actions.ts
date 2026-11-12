'use server';

import { revalidatePath } from 'next/cache';

import { actionError, actionSuccess, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { sendTestEmail } from '@/lib/email/events';
import { isAdminClientConfigured } from '@/lib/supabase/admin';

/** Envoie un e-mail de test à l'administrateur connecté (et à lui seul). */
export async function sendTestEmailToMe(): Promise<ActionState> {
  const user = await requireRole('admin');
  if (!isAdminClientConfigured()) return actionError('La clé de service Supabase n’est pas configurée : la file d’envoi est inaccessible.');
  const result = await sendTestEmail(user);
  revalidatePath('/admin/emails');
  return result.status === 'sent' ? actionSuccess(result.message) : actionError(result.message);
}
