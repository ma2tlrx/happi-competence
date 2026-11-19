import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

import { validatedMappingsBySkill, type MappingRow, type PublicSkillMapping } from './mappings';

/**
 * Correspondances VALIDÉES avec les référentiels publics, par compétence HAPPI
 * (clé « référentiel:code »). Le filtre sur le statut figure dans la requête : la page
 * publique de vérification lit avec la clé de service, qui ne passe pas par RLS.
 * En cas d'erreur (table absente, réseau), aucune correspondance n'est affichée.
 */
export async function loadValidatedMappings(supabase: SupabaseClient<Database>): Promise<Map<string, PublicSkillMapping[]>> {
  const { data, error } = await supabase
    .from('skill_mappings')
    .select('skill_code, link_type, status, frameworks ( code ), external_skills ( code, label, external_frameworks ( code, name, publisher, version ) )')
    .eq('status', 'validated')
    .limit(2000);
  if (error || !data) return new Map();
  return validatedMappingsBySkill(data as unknown as MappingRow[]);
}
