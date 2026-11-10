import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { cache } from 'react';

import type { Database } from '@/lib/supabase/database.types';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export type PublicSkill = { code: string; name: string; description: string | null };
export type PublicCategory = { code: string; name: string; description: string | null; skills: PublicSkill[] };
export type PublicFramework = {
  code: string;
  name: string;
  short_name: string;
  description: string | null;
  scale_min: number;
  scale_max: number;
  is_provisional: boolean;
  levels: { value: number; label: string }[];
  categories: PublicCategory[];
};
export type PublicSession = { number: number; title: string; summary: string | null; is_provisional: boolean };
export type PublicCatalog = {
  program: {
    name: string;
    description: string | null;
    sessions_count: number;
    session_duration_minutes: number;
    min_group_size: number;
    max_group_size: number;
    sessions: PublicSession[];
  } | null;
  frameworks: PublicFramework[];
  settings: Record<string, unknown>;
};

const EMPTY: PublicCatalog = { program: null, frameworks: [], settings: {} };

/**
 * Programme, référentiels publiés et paramètres publics, lus via la fonction
 * get_public_catalog (seule porte ouverte au rôle anonyme).
 */
export const getPublicCatalog = cache(async (): Promise<PublicCatalog> => {
  if (!isSupabaseConfigured()) return EMPTY;
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.rpc('get_public_catalog');
  if (error || !data) {
    console.error('Catalogue public indisponible', error?.message);
    return EMPTY;
  }
  const catalog = data as unknown as PublicCatalog;
  return { program: catalog.program ?? null, frameworks: catalog.frameworks ?? [], settings: catalog.settings ?? {} };
});

export function frameworkByCode(catalog: PublicCatalog, code: string) {
  return catalog.frameworks.find((framework) => framework.code === code) ?? null;
}

export function settingString(catalog: PublicCatalog, key: string): string {
  const value = catalog.settings[key];
  return typeof value === 'string' ? value : '';
}

export function settingList(catalog: PublicCatalog, key: string): string[] {
  const value = catalog.settings[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
