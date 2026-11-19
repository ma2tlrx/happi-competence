'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireRole } from '@/lib/auth/session';
import { revealCredential, verificationUrlOf } from '@/lib/badges/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Lien de vérification d'un badge, pour son seul titulaire : la base ne remet la copie
 * chiffrée du crédential qu'au participant titulaire d'un badge non révoqué.
 */
export async function revealBadgeLink(assertionId: string): Promise<{ ok: boolean; url?: string; message?: string }> {
  const user = await requireRole('participant');
  if (!user.participantId) redirect('/compte');
  if (!z.string().uuid().safeParse(assertionId).success) return { ok: false, message: 'Badge introuvable.' };
  const jwt = await revealCredential(await createClient(), assertionId);
  const url = jwt ? verificationUrlOf(jwt) : null;
  return url ? { ok: true, url } : { ok: false, message: 'Ce badge n’est plus disponible.' };
}
