import 'server-only';

import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { getSupabaseUrl } from './env';

/**
 * Client à privilèges élevés (clé de service) : il contourne RLS.
 *
 * À n'utiliser que dans du code serveur, après avoir vérifié les droits de
 * l'appelant, et uniquement pour ce que la session utilisateur ne peut pas faire :
 * activation d'un code d'accès, enregistrement d'un message de contact,
 * désactivation ou suppression d'un compte.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error('Configuration manquante : SUPABASE_SERVICE_ROLE_KEY (clé secrète, côté serveur uniquement).');
  }
  return createClient<Database>(getSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isAdminClientConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY);
}
