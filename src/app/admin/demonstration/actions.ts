'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { actionError, actionSuccess, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/session';
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
  await supabase.rpc('log_event', { p_action: 'demo.space_opened', p_metadata: { space } });
  const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (error) return actionError(`Connexion au compte de démonstration impossible : ${error.message}`);
  redirect(DEMO_SPACES[space].home);
}
