'use client';

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from './database.types';

/** Client navigateur (clé publique). Soumis aux politiques RLS comme tout appel utilisateur. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
  );
}
