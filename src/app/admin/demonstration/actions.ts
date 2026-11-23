'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { actionError, actionSuccess, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
import { DEMO_RETURN_COOKIE, DEMO_RETURN_TTL_SECONDS, signDemoReturn } from '@/lib/demo/return';
import { createDemo, DEMO_SPACES, demoLoginToken, isDemoAllowed, purgeDemo, type DemoSpace } from '@/lib/demo/environment';
import { isAdminClientConfigured } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

async function guard() {
  await requireRole('admin');
  if (!isDemoAllowed()) return 'La démonstration est désactivée sur cet environnement (HAPPI_ALLOW_DEMO=false).';
  if (!isAdminClientConfigured()) return 'La clé de service Supabase n’est pas configurée sur ce serveur.';
  return null;
}

export async function createDemoAction(): Promise<ActionState> {
  const refusal = await guard();
  if (refusal) return actionError(refusal);
  try {
    const result = await createDemo();
    await (await createClient()).rpc('log_event', { p_action: 'demo.created', p_metadata: result });
    revalidatePath('/admin', 'layout');
    return actionSuccess(`Démonstration prête : ${result.organizations} organismes, ${result.groups} groupes, ${result.participants} participants.`);
  } catch (error) {
    return actionError(`La création a échoué : ${error instanceof Error ? error.message : 'erreur inconnue'}. Les données démo partielles peuvent être supprimées.`);
  }
}

export async function deleteDemoAction(): Promise<ActionState> {
  const refusal = await guard();
  if (refusal) return actionError(refusal);
  try {
    await purgeDemo();
    await (await createClient()).rpc('log_event', { p_action: 'demo.deleted' });
    revalidatePath('/admin', 'layout');
    return actionSuccess('Toutes les données de démonstration ont été supprimées.');
  } catch (error) {
    return actionError(`La suppression a échoué : ${error instanceof Error ? error.message : 'erreur inconnue'}.`);
  }
}

/**
 * Ouvre un espace de démonstration : la session administrateur est remplacée par
 * celle du compte démo (lien de connexion à usage unique généré côté serveur).
 * Seuls les comptes marqués « démo » sont accessibles ainsi.
 */
export async function openDemoSpaceAction(space: DemoSpace): Promise<ActionState> {
  const refusal = await guard();
  if (refusal) return actionError(refusal);
  if (!Object.hasOwn(DEMO_SPACES, space)) return actionError('Espace inconnu.');
  const tokenHash = await demoLoginToken(space);
  if (!tokenHash) return actionError('Ce compte de démonstration n’existe pas : créez d’abord la démonstration.');
  const supabase = await createClient();
  const { data: before } = await supabase.auth.getUser();
  await supabase.rpc('log_event', { p_action: 'demo.space_opened', p_metadata: { space } });
  const { data: opened, error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (error) return actionError(`Connexion au compte de démonstration impossible : ${error.message}`);
  // Témoin signé : « Quitter la démonstration » ramènera l'administrateur à son tableau de bord (src/lib/demo/return.ts).
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? '';
  if (before.user && opened.user && secret) {
    (await cookies()).set(DEMO_RETURN_COOKIE, signDemoReturn(secret, before.user.id, opened.user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: DEMO_RETURN_TTL_SECONDS,
    });
  }
  redirect(DEMO_SPACES[space].home);
}
