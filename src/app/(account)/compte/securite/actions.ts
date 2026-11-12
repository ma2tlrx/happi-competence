'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { actionError, actionSuccess, type ActionState } from '@/lib/action-state';
import { normalizeTotpCode, qrCodeDataUri } from '@/lib/auth/mfa';
import { requireUser } from '@/lib/auth/session';
import { rateLimit, requestIp } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';

export type Enrollment = { factorId: string; qrCode: string; secret: string };

const CODE_HINT = 'Saisissez les 6 chiffres affichés par votre application.';

/**
 * Début de l'activation : Supabase crée un facteur TOTP « non vérifié » et fournit son
 * secret (QR code). Le secret n'est jamais conservé par l'application.
 */
export async function startMfaEnrollment(): Promise<{ ok: true; data: Enrollment } | { ok: false; message: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, message: 'La double authentification est momentanément indisponible.' };
  if (factors.totp.some((factor) => factor.status === 'verified')) {
    return { ok: false, message: 'La double authentification est déjà active sur ce compte.' };
  }
  // Une activation interrompue laisse un facteur non vérifié : on le remplace.
  for (const factor of factors.all.filter((item) => item.factor_type === 'totp' && item.status === 'unverified')) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Application d’authentification', issuer: 'HAPPI Compétence' });
  if (error || !data || data.type !== 'totp') {
    console.error('Activation de la double authentification impossible', error?.message);
    return { ok: false, message: 'La double authentification n’a pas pu être préparée. Réessayez dans un instant.' };
  }
  const qrCode = qrCodeDataUri(data.totp.qr_code);
  if (!qrCode) return { ok: false, message: 'Le QR code n’a pas pu être affiché. Utilisez la clé de configuration.' };
  return { ok: true, data: { factorId: data.id, qrCode, secret: data.totp.secret } };
}

/** Fin de l'activation : le premier code valide vérifie le facteur et passe la session en aal2. */
export async function confirmMfaEnrollment(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const factorId = z.string().uuid().safeParse(formData.get('factorId'));
  if (!factorId.success) return actionError('Recommencez l’activation.');
  const code = normalizeTotpCode(formData.get('code'));
  if (!code) return { ok: false, fieldErrors: { code: CODE_HINT } };
  const limited = await rateLimit('mfa', { user: user.id, ip: await requestIp() });
  if (limited) return actionError(limited);

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factorId.data, code });
  if (error) return actionError('Ce code n’est pas valide. Vérifiez l’heure de votre téléphone et saisissez le code affiché en ce moment.', { code: 'Code refusé.' });
  revalidatePath('/', 'layout');
  return actionSuccess('La double authentification est activée. Un code vous sera demandé à chaque connexion.');
}

/** Désactivation : exige un code valide (preuve de possession), refusée si la plateforme l'impose à ce rôle. */
export async function disableMfa(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.mfa.required) {
    return actionError('La double authentification est obligatoire pour votre rôle : elle ne peut pas être désactivée.');
  }
  const code = normalizeTotpCode(formData.get('code'));
  if (!code) return { ok: false, fieldErrors: { code: CODE_HINT } };
  const limited = await rateLimit('mfa', { user: user.id, ip: await requestIp() });
  if (limited) return actionError(limited);

  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp.filter((factor) => factor.status === 'verified') ?? [];
  if (listError || verified.length === 0) return actionError('Aucune double authentification active sur ce compte.');
  const check = await supabase.auth.mfa.challengeAndVerify({ factorId: verified[0]!.id, code });
  if (check.error) return actionError('Ce code n’est pas valide. Saisissez le code affiché en ce moment.', { code: 'Code refusé.' });
  for (const factor of verified) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) return actionError('La double authentification n’a pas pu être désactivée. Réessayez dans un instant.');
  }
  revalidatePath('/', 'layout');
  return actionSuccess('La double authentification est désactivée.');
}
