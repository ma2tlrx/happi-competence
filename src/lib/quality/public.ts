import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { cache } from 'react';

import type { Database } from '@/lib/supabase/database.types';
import { isSupabaseConfigured } from '@/lib/supabase/env';

import { parsePublicIndicators, type PublicIndicators } from './indicators';

export type PublicResults = { periodFrom: string | null; periodTo: string | null; computedAt: string; indicators: PublicIndicators };

/**
 * Indicateurs de résultats publiés (page /resultats), lus avec la clé publique via
 * get_public_results : null tant que l'administrateur n'a pas activé la publication.
 */
export const getPublicResults = cache(async (): Promise<PublicResults | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.rpc('get_public_results');
  if (error || !data || typeof data !== 'object') return null;
  const value = data as { period_from?: string | null; period_to?: string | null; computed_at?: string | null; indicators?: unknown };
  const indicators = parsePublicIndicators(value.indicators);
  if (!indicators || !value.computed_at) return null;
  return { periodFrom: value.period_from ?? null, periodTo: value.period_to ?? null, computedAt: value.computed_at, indicators };
});
