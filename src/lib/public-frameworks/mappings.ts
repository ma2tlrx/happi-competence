import { normalizeLabel } from './import';

/**
 * Correspondances entre compétences HAPPI et référentiels publics — module pur.
 * Recherche d'un élément externe, filtres de l'administration, et sélection des
 * seules correspondances VALIDÉES pour l'affichage hors administration (passeport,
 * CV de compétences, page de vérification, export CSV). Les niveaux et les scores
 * ne sont jamais concernés.
 */

export const LINK_TYPES = {
  equivalent: { label: 'Équivalent', description: 'La même compétence, dite autrement.' },
  close: { label: 'Proche', description: 'Des compétences voisines : l’essentiel se recoupe.' },
  partial: { label: 'Partiel', description: 'Une partie seulement se recoupe.' },
} as const;
export type LinkType = keyof typeof LINK_TYPES;
export const LINK_TYPE_ORDER: LinkType[] = ['equivalent', 'close', 'partial'];
export const isLinkType = (value: string): value is LinkType => value in LINK_TYPES;

export const MAPPING_STATUS = {
  proposed: { label: 'Proposée', variant: 'warning' },
  validated: { label: 'Validée', variant: 'success' },
} as const;
export type MappingStatus = keyof typeof MAPPING_STATUS;

export type ExternalSource = { code: string; name: string; publisher: string; version: string };

/** Élément d'un référentiel public, tel que proposé à la recherche. */
export type ExternalSkillOption = {
  id: string;
  code: string;
  label: string;
  definition: string | null;
  isActive: boolean;
  source: ExternalSource;
};

/** Correspondance affichable hors administration (toujours validée). */
export type PublicSkillMapping = { code: string; label: string; linkType: LinkType; source: ExternalSource };

/** « ESCO (Commission européenne), version 1.2.1 » : la source accompagne toujours la correspondance. */
export function sourceMention(source: ExternalSource) {
  return `${source.name} (${source.publisher}), version ${source.version}`;
}

/** Courte : « ESCO 1.2.1 », pour les documents d'une page. */
export function shortSourceMention(source: ExternalSource) {
  return `${source.name} ${source.version}`;
}

/** Référentiel de métiers (fiches ROME) : le lien dit « où la compétence sert », pas « même compétence dite autrement ». */
export const METIER_SOURCE_CODE = 'rome_metiers';
export const isMetierMapping = (mapping: PublicSkillMapping) => mapping.source.code === METIER_SOURCE_CODE;

export function mappingLine(mapping: PublicSkillMapping) {
  if (isMetierMapping(mapping)) return `Métier ROME « ${mapping.label} » — ${shortSourceMention(mapping.source)}`;
  return `« ${mapping.label} » (${LINK_TYPES[mapping.linkType].label.toLowerCase()}) — ${shortSourceMention(mapping.source)}`;
}

/**
 * Recherche d'un élément externe : tous les mots de la requête doivent figurer dans le
 * libellé, le code ou la définition (accents et casse ignorés). Classement : libellé
 * exact, libellé qui commence par la requête, requête contenue dans le libellé, mots
 * dans le libellé, puis correspondances par la définition seulement.
 */
export function searchExternalSkills(
  options: ExternalSkillOption[],
  query: string,
  { sourceCode = null, excludeIds = [], limit = 20, includeInactive = false }: { sourceCode?: string | null; excludeIds?: string[]; limit?: number; includeInactive?: boolean } = {},
): ExternalSkillOption[] {
  const wanted = normalizeLabel(query);
  const excluded = new Set(excludeIds);
  const pool = options.filter((option) => (includeInactive || option.isActive) && !excluded.has(option.id) && (!sourceCode || option.source.code === sourceCode));
  if (!wanted) return pool.slice(0, limit);
  const tokens = wanted.split(' ');
  const ranked: { option: ExternalSkillOption; rank: number }[] = [];
  for (const option of pool) {
    const label = normalizeLabel(option.label);
    const code = normalizeLabel(option.code);
    const definition = normalizeLabel(option.definition);
    const inLabel = tokens.every((token) => label.includes(token) || code.includes(token));
    const anywhere = inLabel || tokens.every((token) => label.includes(token) || code.includes(token) || definition.includes(token));
    if (!anywhere) continue;
    const rank = label === wanted ? 0 : label.startsWith(wanted) ? 1 : label.includes(wanted) ? 2 : inLabel ? 3 : 4;
    ranked.push({ option, rank });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.option.label.localeCompare(b.option.label, 'fr'))
    .slice(0, limit)
    .map((item) => item.option);
}

/** Ligne de correspondance telle que lue en base (jointures comprises). */
export type MappingRow = {
  skill_code: string;
  link_type: string;
  status: string;
  frameworks: { code: string } | null;
  external_skills: {
    code: string;
    label: string;
    external_frameworks: { code: string; name: string; publisher: string; version: string } | null;
  } | null;
};

export const mappingKey = (frameworkCode: string, skillCode: string) => `${frameworkCode}:${skillCode}`;

/**
 * Correspondances VALIDÉES par compétence (clé référentiel:code). Le filtre sur le statut
 * est refait ici, même si la requête et RLS l'appliquent déjà : la page publique lit avec
 * la clé de service, qui ne passe pas par RLS.
 */
export function validatedMappingsBySkill(rows: MappingRow[]): Map<string, PublicSkillMapping[]> {
  const result = new Map<string, PublicSkillMapping[]>();
  for (const row of rows) {
    if (row.status !== 'validated' || !isLinkType(row.link_type) || !row.frameworks || !row.external_skills?.external_frameworks) continue;
    const source = row.external_skills.external_frameworks;
    const key = mappingKey(row.frameworks.code, row.skill_code);
    const list = result.get(key) ?? [];
    list.push({
      code: row.external_skills.code,
      label: row.external_skills.label,
      linkType: row.link_type,
      source: { code: source.code, name: source.name, publisher: source.publisher, version: source.version },
    });
    result.set(key, list);
  }
  for (const list of result.values()) {
    list.sort((a, b) => LINK_TYPE_ORDER.indexOf(a.linkType) - LINK_TYPE_ORDER.indexOf(b.linkType) || a.source.name.localeCompare(b.source.name, 'fr') || a.label.localeCompare(b.label, 'fr'));
  }
  return result;
}

/** Sources distinctes (référentiel et version), pour la mention de bas de document. */
export function distinctSources(sources: ExternalSource[]): ExternalSource[] {
  const seen = new Map<string, ExternalSource>();
  for (const source of sources) seen.set(`${source.code}@${source.version}`, source);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

// ── Administration : filtres du tableau des correspondances ─────────────────
export type AdminMapping = {
  id: string;
  status: MappingStatus;
  linkType: LinkType;
  origin: 'manual' | 'label_match';
  justification: string | null;
  proposedAt: string;
  proposedBy: string | null;
  validatedAt: string | null;
  validatedBy: string | null;
  external: ExternalSkillOption;
};

export type AdminSkillRow = {
  frameworkId: string;
  frameworkCode: string;
  frameworkName: string;
  code: string;
  name: string;
  description: string | null;
  mappings: AdminMapping[];
};

export type MappingFilters = { framework: string | null; status: 'all' | 'proposed' | 'validated' | 'none'; source: string | null; q: string };

export function parseMappingFilters(params: Record<string, string | string[] | undefined>): MappingFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
  };
  const status = one('statut');
  return {
    framework: /^[a-z_]{1,40}$/.test(one('referentiel')) ? one('referentiel') : null,
    status: status === 'proposed' || status === 'validated' || status === 'none' ? status : 'all',
    source: /^[a-z0-9_]{2,40}$/.test(one('source')) ? one('source') : null,
    q: one('q').slice(0, 80),
  };
}

/**
 * Filtre des compétences HAPPI. Le statut et la source portent sur les correspondances :
 * « proposed » garde les compétences qui ont au moins une proposition (de cette source,
 * si elle est choisie), « none » celles qui n'en ont aucune.
 */
export function filterSkillRows(rows: AdminSkillRow[], filters: MappingFilters): AdminSkillRow[] {
  const query = normalizeLabel(filters.q);
  return rows.filter((row) => {
    if (filters.framework && row.frameworkCode !== filters.framework) return false;
    if (query && !normalizeLabel(`${row.name} ${row.code}`).includes(query)) return false;
    const inSource = row.mappings.filter((mapping) => !filters.source || mapping.external.source.code === filters.source);
    if (filters.status === 'none') return inSource.length === 0;
    if (filters.status === 'proposed' || filters.status === 'validated') return inSource.some((mapping) => mapping.status === filters.status);
    return true;
  });
}

export function mappingCounts(rows: AdminSkillRow[]) {
  const all = rows.flatMap((row) => row.mappings);
  return {
    skills: rows.length,
    mapped: rows.filter((row) => row.mappings.some((mapping) => mapping.status === 'validated')).length,
    proposed: all.filter((mapping) => mapping.status === 'proposed').length,
    validated: all.filter((mapping) => mapping.status === 'validated').length,
  };
}
