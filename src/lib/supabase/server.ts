import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from './database.types';
import { getSupabasePublicKey, getSupabaseUrl } from './env';

/**
 * Client Supabase lié à la session de l'utilisateur (cookies).
 * Toutes les requêtes passent par les politiques RLS : c'est le client par défaut.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(getSupabaseUrl(), getSupabasePublicKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Appelé depuis un composant serveur : l'écriture de cookies y est impossible.
          // Le rafraîchissement de session est alors assuré par le proxy.
        }
      },
    },
  });
}

export type ServerClient = Awaited<ReturnType<typeof createClient>>;
