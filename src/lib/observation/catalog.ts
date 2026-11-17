import 'server-only';

import type { ServerClient } from '@/lib/supabase/server';

import { criterionRef, type CatalogSkill } from './structure';

/**
 * Compétences et critères observables pendant une séance (mêmes règles que la page
 * des évaluations : référentiels activés pour le programme, correspondance de la
 * séance si elle est définie). Lecture sous les droits de l'appelant.
 */
export async function loadSessionCatalog(supabase: ServerClient, sessionId: string): Promise<{ skills: CatalogSkill[]; levelLabels: string[]; groupId: string } | null> {
  const { data: session } = await supabase.from('sessions').select('id, number, group_id, groups ( program_id )').eq('id', sessionId).maybeSingle();
  if (!session?.groups) return null;
  const { data: links } = await supabase.from('program_frameworks').select('framework_version_id').eq('program_id', session.groups.program_id);
  const versionIds = (links ?? []).map((link) => link.framework_version_id);
  if (versionIds.length === 0) return { skills: [], levelLabels: [], groupId: session.group_id };

  const [versions, levels, skills, mapping] = await Promise.all([
    supabase.from('framework_versions').select('id, frameworks ( name, position )').in('id', versionIds),
    supabase.from('scale_levels').select('label').in('version_id', versionIds),
    supabase
      .from('skills')
      .select('id, version_id, code, name, description, position, skill_criteria ( id, label, position, is_active )')
      .in('version_id', versionIds)
      .eq('is_active', true),
    supabase.from('session_skill_map').select('skill_id, version_id').in('version_id', versionIds).eq('session_number', session.number),
  ]);

  const mapped = new Map<string, Set<string>>();
  for (const row of mapping.data ?? []) mapped.set(row.version_id, (mapped.get(row.version_id) ?? new Set()).add(row.skill_id));
  const frameworkName = new Map((versions.data ?? []).map((version) => [version.id, version.frameworks?.name ?? '']));
  const order = new Map((versions.data ?? []).map((version) => [version.id, version.frameworks?.position ?? 0]));

  const catalog = (skills.data ?? [])
    .filter((skill) => {
      const set = mapped.get(skill.version_id);
      return !set || set.size === 0 || set.has(skill.id);
    })
    .sort((a, b) => (order.get(a.version_id) ?? 0) - (order.get(b.version_id) ?? 0) || a.position - b.position)
    .map((skill) => ({
      code: skill.code,
      id: skill.id,
      name: skill.name,
      description: skill.description,
      framework: frameworkName.get(skill.version_id) ?? '',
      criteria: skill.skill_criteria
        .filter((criterion) => criterion.is_active)
        .sort((a, b) => a.position - b.position)
        .map((criterion, index) => ({ ref: criterionRef(skill.code, index), id: criterion.id, label: criterion.label })),
    }));
  return { skills: catalog, levelLabels: [...new Set((levels.data ?? []).map((level) => level.label))], groupId: session.group_id };
}
