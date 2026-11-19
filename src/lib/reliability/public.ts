import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { cache } from 'react';

import type { Database } from '@/lib/supabase/database.types';
import { isSupabaseConfigured } from '@/lib/supabase/env';

import { parsePublicReliability, type PublicReliability } from './report';

/** Statistiques d'accord publiées (page « Notre méthode ») ; null tant que rien n'est publié. */
export const getPublicReliability = cache(async (): Promise<PublicReliability | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.rpc('get_public_reliability');
  if (error || !data) return null;
  return parsePublicReliability(data);
});
