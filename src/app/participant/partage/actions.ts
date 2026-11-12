'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { actionError, actionSuccess, databaseErrorMessage, validationError, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { qrSvg } from '@/lib/passport-share/qr';
import { shareFormSchema } from '@/lib/passport-share/rules';
import { revealShareToken, shareKeys, shareUrl } from '@/lib/passport-share/server';
import { encryptShareToken, generateShareToken, hashShareToken } from '@/lib/passport-share/token';
import { createClient } from '@/lib/supabase/server';

/**
 * Liens de partage du passeport. Seul le participant titulaire agit : le rôle est
 * vérifié ici, et la base revérifie (create/revoke_passport_share, my_passport_share_secret).
 * Le jeton n'est renvoyé qu'au titulaire et n'est jamais journalisé.
 */

export type RevealedShare = { shareId: string; url: string; svg: string };
type Simple = { ok: boolean; message?: string };

const PATH = '/participant/partage';
const uuid = z.string().uuid();

async function participant() {
  const user = await requireRole('participant');
  if (!user.participantId) redirect('/compte');
  return { user, supabase: await createClient() };
}

export async function createShare(_: ActionState<RevealedShare>, formData: FormData): Promise<ActionState<RevealedShare>> {
  const { supabase } = await participant();
  const parsed = shareFormSchema.safeParse({
    label: formData.get('label') ?? '',
    duration: formData.get('duration'),
    includeSociocognitive: formData.get('includeSociocognitive'),
    includeReport: formData.get('includeReport'),
  });
  if (!parsed.success) return validationError(parsed.error);

  const token = generateShareToken();
  const { data: shareId, error } = await supabase.rpc('create_passport_share', {
    p_token_hash: hashShareToken(token),
    p_token_ciphertext: encryptShareToken(token, shareKeys().encryption),
    p_label: parsed.data.label,
    p_duration_days: parsed.data.duration,
    p_include_sociocognitive: parsed.data.includeSociocognitive,
    p_include_report: parsed.data.includeReport,
  });
  if (error || !shareId) return actionError(databaseErrorMessage(error));
  revalidatePath(PATH);
  const url = shareUrl(token);
  return actionSuccess('Lien créé. Copiez-le ou montrez le QR code à la personne concernée.', { shareId, url, svg: await qrSvg(url) });
}

export async function revealShare(shareId: string): Promise<ActionState<RevealedShare>> {
  const { supabase } = await participant();
  if (!uuid.safeParse(shareId).success) return actionError('Lien introuvable.');
  const token = await revealShareToken(supabase, shareId);
  if (!token) return actionError('Ce lien n’est plus actif ou ne peut plus être affiché. Créez-en un nouveau.');
  const url = shareUrl(token);
  return actionSuccess(undefined, { shareId, url, svg: await qrSvg(url) });
}

export async function revokeShare(shareId: string): Promise<Simple> {
  const { supabase } = await participant();
  if (!uuid.safeParse(shareId).success) return { ok: false, message: 'Lien introuvable.' };
  const { error } = await supabase.rpc('revoke_passport_share', { p_share_id: shareId });
  if (error) return { ok: false, message: databaseErrorMessage(error) };
  revalidatePath(PATH);
  return { ok: true };
}
