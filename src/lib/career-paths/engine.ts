/**
 * Moteur des pistes métiers (module pur, sans IA, déterministe). Règles : docs/pistes-metiers.md.
 *
 * 1. Points d'appui : ceux que le moteur d'évaluation existant a déjà dégagés (`highlights.strengths`),
 *    dans les référentiels où il y a assez d'observations. Aucun seuil nouveau n'est créé.
 * 2. Ancrages : savoir-être ROME reliés à ces points d'appui par une correspondance VALIDÉE ; poids
 *    du lien (équivalent 1, proche 0,75, partiel 0,5).
 * 3. Rapprochement d'une fiche : somme, sur les savoir-être de la fiche qui sont des ancrages, de
 *    poids × rareté (un savoir-être demandé par peu de fiches distingue davantage : ln(1 + N / n)).
 *    Ce calcul sert seulement à ORDONNER : il n'est ni conservé ni affiché. À égalité : fiche dont les
 *    attentes sont le mieux couvertes, puis famille de métiers la plus large (nombre d'appellations).
 *    Un domaine professionnel est jugé sur la moyenne de toutes ses fiches (une fiche sans ancrage compte 0),
 *    puis illustré par sa fiche la plus proche.
 * 4. Trois pistes, dans trois domaines professionnels différents (et si possible trois grands
 *    domaines) : jusqu'à deux dans les secteurs déclarés par la personne, puis au moins une ouverture
 *    hors de ces secteurs ; sans secteur déclaré, trois pistes d'après les seuls points d'appui.
 */
import { CAREER_PATHS_COUNT, CAREER_PATHS_ENGINE_VERSION, type CareerPath, type CareerPathAnchor, type CareerPathBasis, type CareerPaths, type CareerPathsUnavailable } from './model';
import { isSectorCode, SECTOR_ROME_PREFIXES } from './sectors';

export type LinkType = 'equivalent' | 'close' | 'partial';

/** Poids d'une correspondance selon son type (réglage par défaut, documenté). */
export const LINK_WEIGHTS: Record<LinkType, number> = { equivalent: 1, close: 0.75, partial: 0.5 };

export const MAX_EXAMPLES = 3;

export type RomeReference = {
  /** Libellés officiels : grands domaines (« K ») et domaines professionnels (« K12 »). */
  domains: Record<string, string>;
  fiches: { code: string; appellations: string[]; savoirEtre: string[] }[];
};

export type CareerPathsInputs = {
  frameworks: {
    code: string;
    /** Le moteur d'évaluation juge les observations insuffisantes pour dégager des points d'appui. */
    insufficient: boolean;
    /** Codes des compétences « points d'appui » (moteur d'évaluation existant). */
    strengths: string[];
    skills: { code: string; name: string }[];
  }[];
  /** Correspondances VALIDÉES seulement. */
  mappings: { frameworkCode: string; skillCode: string; savoirEtreCode: string; savoirEtreLabel: string; linkType: LinkType }[];
  reference: RomeReference | null;
  /** Codes des secteurs déclarés au questionnaire d'accueil. */
  declaredSectors: string[];
  source: string;
};

type Anchor = { code: string; label: string; weight: number; skills: string[] };
type Candidate = { fiche: RomeReference['fiches'][number]; subdomain: string; domain: string; matched: Anchor[]; rank: number; coverage: number };

function unavailable(base: Omit<CareerPaths, 'status' | 'reason' | 'paths'>, reason: CareerPathsUnavailable): CareerPaths {
  return { ...base, status: 'unavailable', reason, paths: [] };
}

function examplesOf(appellations: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of appellations) {
    const label = raw.trim();
    const key = label.toLocaleLowerCase('fr');
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length === MAX_EXAMPLES) break;
  }
  return out;
}

/**
 * Ordre : rapprochement, puis attentes de la fiche le mieux couvertes, puis métier le plus large
 * (plus d'appellations : une famille de métiers plus ouverte qu'un métier de niche), puis code.
 */
const byRank = (a: Candidate, b: Candidate) =>
  b.rank - a.rank || b.coverage - a.coverage || b.fiche.appellations.length - a.fiche.appellations.length || a.fiche.code.localeCompare(b.fiche.code);

export function computeCareerPaths(inputs: CareerPathsInputs): CareerPaths {
  const declared = [...new Set(inputs.declaredSectors)].filter(isSectorCode);
  const base = {
    engineVersion: CAREER_PATHS_ENGINE_VERSION,
    source: inputs.source,
    strengths: [] as string[],
  };

  const reference = inputs.reference;
  if (!reference || reference.fiches.length === 0) return unavailable(base, 'no_reference');
  if (inputs.mappings.length === 0) return unavailable(base, 'no_validated_mappings');

  // 1. Points d'appui.
  const strengthKeys: { framework: string; code: string; name: string }[] = [];
  for (const framework of inputs.frameworks) {
    if (framework.insufficient) continue;
    const names = new Map(framework.skills.map((skill) => [skill.code, skill.name]));
    for (const code of framework.strengths) strengthKeys.push({ framework: framework.code, code, name: names.get(code) ?? code });
  }
  base.strengths = strengthKeys.map((key) => key.name);
  if (strengthKeys.length === 0) return unavailable(base, 'no_strengths');

  // 2. Ancrages.
  const anchors = new Map<string, Anchor>();
  for (const key of strengthKeys) {
    for (const mapping of inputs.mappings) {
      if (mapping.frameworkCode !== key.framework || mapping.skillCode !== key.code) continue;
      const anchor = anchors.get(mapping.savoirEtreCode) ?? { code: mapping.savoirEtreCode, label: mapping.savoirEtreLabel, weight: 0, skills: [] };
      anchor.weight = Math.max(anchor.weight, LINK_WEIGHTS[mapping.linkType]);
      if (!anchor.skills.includes(key.name)) anchor.skills.push(key.name);
      anchors.set(anchor.code, anchor);
    }
  }
  if (anchors.size === 0) return unavailable(base, 'no_anchors');

  // 3. Rapprochement des fiches (rareté de chaque savoir-être dans le référentiel).
  const total = reference.fiches.length;
  const frequency = new Map<string, number>();
  for (const fiche of reference.fiches) for (const code of new Set(fiche.savoirEtre)) frequency.set(code, (frequency.get(code) ?? 0) + 1);
  const rarity = (code: string) => Math.log(1 + total / (frequency.get(code) ?? total));

  const bestBySubdomain = new Map<string, Candidate>();
  // Rapprochement moyen de TOUTES les fiches d'un domaine professionnel (0 pour une fiche sans ancrage) :
  // on recommande un domaine où vos points d'appui comptent souvent, pas un métier de niche isolé.
  const subdomainTotals = new Map<string, { sum: number; count: number }>();
  for (const fiche of reference.fiches) {
    const own = [...new Set(fiche.savoirEtre)];
    const matched = own.map((code) => anchors.get(code)).filter((anchor): anchor is Anchor => Boolean(anchor));
    const subdomain = fiche.code.slice(0, 3);
    const totals = subdomainTotals.get(subdomain) ?? { sum: 0, count: 0 };
    totals.count += 1;
    subdomainTotals.set(subdomain, totals);
    if (matched.length === 0) continue;
    if (!reference.domains[subdomain] || !reference.domains[fiche.code[0]!]) continue;
    const rank = matched.reduce((sum, anchor) => sum + anchor.weight * rarity(anchor.code), 0);
    const coverage = rank / own.reduce((sum, code) => sum + rarity(code), 0);
    totals.sum += rank;
    const candidate: Candidate = { fiche, subdomain, domain: fiche.code[0]!, matched, rank, coverage };
    const current = bestBySubdomain.get(subdomain);
    if (!current || byRank(candidate, current) < 0) bestBySubdomain.set(subdomain, candidate);
  }
  // Les domaines professionnels sont ordonnés par leur rapprochement moyen ; chacun est illustré par sa fiche la plus proche.
  const candidates = [...bestBySubdomain.values()]
    .map((candidate) => {
      const totals = subdomainTotals.get(candidate.subdomain)!;
      return { ...candidate, rank: totals.sum / totals.count };
    })
    .sort(byRank);

  // 4. Sélection impartiale.
  const sectorOf = (candidate: Candidate) => declared.find((sector) => SECTOR_ROME_PREFIXES[sector].some((prefix) => candidate.fiche.code.startsWith(prefix))) ?? null;
  const inDeclared = candidates.filter((candidate) => sectorOf(candidate) !== null);
  const outside = candidates.filter((candidate) => sectorOf(candidate) === null);

  const chosen: { candidate: Candidate; basis: CareerPathBasis }[] = [];
  const pick = (pool: Candidate[], basis: CareerPathBasis, limit: number, preferNewSector = false) => {
    for (let added = 0; added < limit && chosen.length < CAREER_PATHS_COUNT; added += 1) {
      const free = pool.filter((candidate) => !chosen.some((entry) => entry.candidate.subdomain === candidate.subdomain));
      const usedDomains = new Set(chosen.map((entry) => entry.candidate.domain));
      const usedSectors = new Set(chosen.map((entry) => sectorOf(entry.candidate)));
      const next =
        (preferNewSector && free.find((candidate) => !usedDomains.has(candidate.domain) && !usedSectors.has(sectorOf(candidate)))) ||
        free.find((candidate) => !usedDomains.has(candidate.domain)) ||
        free[0];
      if (!next) return;
      chosen.push({ candidate: next, basis });
    }
  };
  const hasDeclared = declared.some((sector) => SECTOR_ROME_PREFIXES[sector].length > 0);
  if (hasDeclared) {
    pick(inDeclared, 'declared_sector', CAREER_PATHS_COUNT - 1, true);
    pick(outside, 'opening', CAREER_PATHS_COUNT);
  } else {
    pick(candidates, 'strengths', CAREER_PATHS_COUNT);
  }

  const paths: CareerPath[] = chosen.map(({ candidate, basis }) => {
    const anchorsOut: CareerPathAnchor[] = [...candidate.matched]
      .sort((a, b) => b.weight * rarity(b.code) - a.weight * rarity(a.code) || a.code.localeCompare(b.code))
      .map((anchor) => ({ code: anchor.code, label: anchor.label, happiSkills: [...anchor.skills] }));
    return {
      basis,
      domain: { code: candidate.domain, label: reference.domains[candidate.domain]! },
      subdomain: { code: candidate.subdomain, label: reference.domains[candidate.subdomain]! },
      ficheCode: candidate.fiche.code,
      examples: examplesOf(candidate.fiche.appellations),
      anchors: anchorsOut,
    };
  });

  return { ...base, status: 'ok', reason: null, paths };
}
