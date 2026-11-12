'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { insertSignature, type SignResult } from '@/lib/attendance/sign';
import { MAX_SIGNATURE_PATH_LENGTH } from '@/lib/attendance/signature';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({ sessionId: z.uuid(), path: z.string().max(MAX_SIGNATURE_PATH_LENGTH) });

/**
 * Émargement depuis le compte du participant, pour lui-même uniquement : l'identifiant
 * de la fiche vient de la session, jamais du navigateur ; RLS revérifie tout.
 */
export async function signOwnAttendance(input: z.input<typeof schema>): Promise<SignResult> {
  const user = await requireRole('participant');
  if (!user.participantId) return { ok: false, message: 'Votre compte n’est pas encore relié à une fiche participant.' };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Saisie invalide.' };
  const result = await insertSignature(await createClient(), {
    kind: 'drawn',
    sessionId: parsed.data.sessionId,
    participantId: user.participantId,
    path: parsed.data.path,
  });
  if (result.ok) revalidatePath('/participant', 'layout');
  return result;
}
