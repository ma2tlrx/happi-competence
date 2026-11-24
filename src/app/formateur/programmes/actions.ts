'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { databaseErrorMessage } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

const uuid = z.string().uuid();

/**
 * Valide un compte Passeport Numérique : la personne est rattachée à une session (groupe) du programme,
 * ce qui lui ouvre l'accès aux ateliers. Les droits sont revérifiés par la base (add_participant_to_group).
 */
export async function approvePasseportNumeriqueAccount(participantId: string, groupId: string): Promise<{ ok: boolean; message?: string }> {
  await requireRole('formateur', 'admin');
  if (!uuid.safeParse(participantId).success || !uuid.safeParse(groupId).success) return { ok: false, message: 'Demande invalide.' };
  const supabase = await createClient();
  const { data: group } = await supabase.from('groups').select('id, programs ( kind )').eq('id', groupId).maybeSingle();
  if (group?.programs?.kind !== 'passeport_numerique') return { ok: false, message: 'Choisissez une session du Passeport Numérique.' };
  const { error } = await supabase.rpc('add_participant_to_group', { p_group_id: groupId, p_participant_id: participantId });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath('/formateur/programmes');
  revalidatePath(`/formateur/groupes/${groupId}`);
  return { ok: true };
}
