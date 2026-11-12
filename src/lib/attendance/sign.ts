import 'server-only';

import { z } from 'zod';

import { databaseErrorMessage } from '@/lib/action-state';
import { requestOrigin } from '@/lib/security/origin';
import type { createClient } from '@/lib/supabase/server';

import { MAX_SIGNATURE_PATH_LENGTH, validateSignaturePath } from './signature';

type Client = Awaited<ReturnType<typeof createClient>>;
export type SignResult = { ok: boolean; message?: string; signedAt?: string };

export const signatureInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('drawn'), sessionId: z.uuid(), participantId: z.uuid(), path: z.string().max(MAX_SIGNATURE_PATH_LENGTH) }),
  z.object({
    kind: z.literal('unable'),
    sessionId: z.uuid(),
    participantId: z.uuid(),
    reason: z.string().trim().min(3, 'Indiquez le motif (3 caractères au moins).').max(300, 'Motif trop long (300 caractères au maximum).'),
  }),
]);

const REFUSED =
  'Signature refusée : l’émargement n’est possible que le jour de la séance (ou pendant qu’elle est en cours), pour un participant noté présent, ' +
  'et tant que la feuille n’est pas contre-signée.';

function signError(error: { code?: string; message?: string }) {
  if (error.code === '23505') return 'Ce participant a déjà signé pour cette séance.';
  if (error.code === '42501') return REFUSED;
  return databaseErrorMessage(error, 'La signature n’a pas pu être enregistrée. Réessayez dans un instant.');
}

/**
 * Enregistre une signature avec le client de l'utilisateur : RLS (private.can_sign_attendance)
 * décide qui peut signer pour qui ; la base fixe l'heure, l'auteur, le mode et l'empreinte.
 */
export async function insertSignature(supabase: Client, input: z.infer<typeof signatureInputSchema>): Promise<SignResult> {
  if (input.kind === 'drawn') {
    const check = validateSignaturePath(input.path);
    if (!check.ok) return { ok: false, message: check.message };
  }
  const { ipHash, userAgent } = await requestOrigin('happi-emargement');
  const { data, error } = await supabase
    .from('attendance_signatures')
    .insert({
      session_id: input.sessionId,
      participant_id: input.participantId,
      kind: input.kind,
      signature_svg: input.kind === 'drawn' ? input.path : null,
      unable_reason: input.kind === 'unable' ? input.reason : null,
      ip_hmac: ipHash,
      user_agent: userAgent,
    })
    .select('signed_at')
    .single();
  if (error) return { ok: false, message: signError(error) };
  return { ok: true, signedAt: data.signed_at };
}

/** Contre-signature du formateur : la base vérifie que toutes les présences sont saisies, puis fige la feuille. */
export async function insertCountersignature(supabase: Client, sessionId: string, path: string): Promise<SignResult> {
  const check = validateSignaturePath(path);
  if (!check.ok) return { ok: false, message: check.message };
  const { ipHash, userAgent } = await requestOrigin('happi-emargement');
  const { data, error } = await supabase
    .from('attendance_countersignatures')
    .insert({ session_id: sessionId, signature_svg: path, ip_hmac: ipHash, user_agent: userAgent })
    .select('signed_at')
    .single();
  if (error) {
    if (error.code === '23505') return { ok: false, message: 'Cette feuille est déjà contre-signée.' };
    if (error.code === '42501' && /row-level security/i.test(error.message ?? '')) {
      return { ok: false, message: 'Seul un formateur du groupe peut contre-signer cette feuille.' };
    }
    return { ok: false, message: databaseErrorMessage(error) };
  }
  return { ok: true, signedAt: data.signed_at };
}
