/**
 * Rapprochement des secondes cotations et des évaluations officielles, puis synthèse par
 * version de référentiel (chaque version a sa propre échelle : on ne mélange jamais deux échelles),
 * par compétence et par formateur. Module pur, sans accès à la base.
 *
 * Règles (docs/fiabilite.md) :
 *   • seule l'évaluation officielle VALIDÉE sert de référence ; une seconde cotation sans
 *     évaluation officielle validée est comptée à part, jamais appariée ;
 *   • une paire dont les deux cotations viennent du même compte est écartée ;
 *   • « non observé » d'un seul côté : désaccord sur l'observabilité, compté à part ;
 *     « non observé » des deux côtés : rien à comparer ;
 *   • par formateur : toutes les paires où il est l'un des deux observateurs.
 */
import { agreementStats, type AgreementStats, type Scale } from './statistics';

export type DatasetVersion = { id: string; frameworkCode: string; frameworkName: string; versionNumber: number; label: string; scale: Scale };
export type DatasetSkill = { id: string; versionId: string; code: string; name: string; position: number };
export type DatasetScore = { skillId: string; score: number | null };
export type DatasetRating = {
  id: string;
  sessionId: string;
  participantId: string;
  raterId: string;
  origin: 'co_trainer' | 'exercise';
  /** Révision de l'évaluation officielle au moment de la soumission (null si elle n'existait pas). */
  officialRevision: number | null;
  scores: DatasetScore[];
};
export type DatasetOfficial = { sessionId: string; participantId: string; evaluatorId: string | null; revision: number; scores: DatasetScore[] };
export type ReliabilityDataset = {
  versions: DatasetVersion[];
  skills: DatasetSkill[];
  ratings: DatasetRating[];
  officials: DatasetOfficial[];
  raterNames: Record<string, string>;
};

export type PairStatus = 'pair' | 'not_observed_official' | 'not_observed_second';
export type PairRecord = {
  ratingId: string;
  sessionId: string;
  participantId: string;
  versionId: string;
  skillId: string;
  officialRaterId: string | null;
  secondRaterId: string;
  origin: DatasetRating['origin'];
  official: number | null;
  second: number | null;
  status: PairStatus;
  /** L'évaluation officielle a été modifiée (tracé) après la soumission de la seconde cotation. */
  amendedAfter: boolean;
};

export type PairingResult = {
  records: PairRecord[];
  /** Secondes cotations soumises sans évaluation officielle validée correspondante. */
  withoutOfficial: number;
  /** Secondes cotations écartées car saisies par l'auteur de l'évaluation officielle. */
  sameRater: number;
};

const key = (sessionId: string, participantId: string) => `${sessionId}:${participantId}`;

export function pairRatings(dataset: ReliabilityDataset): PairingResult {
  const officials = new Map(dataset.officials.map((official) => [key(official.sessionId, official.participantId), official]));
  const skillVersion = new Map(dataset.skills.map((skill) => [skill.id, skill.versionId]));
  const records: PairRecord[] = [];
  let withoutOfficial = 0;
  let sameRater = 0;
  for (const rating of dataset.ratings) {
    const official = officials.get(key(rating.sessionId, rating.participantId));
    if (!official) {
      withoutOfficial += 1;
      continue;
    }
    if (official.evaluatorId === rating.raterId) {
      sameRater += 1;
      continue;
    }
    const officialScores = new Map(official.scores.map((score) => [score.skillId, score.score]));
    const secondScores = new Map(rating.scores.map((score) => [score.skillId, score.score]));
    const skillIds = [...new Set([...officialScores.keys(), ...secondScores.keys()])];
    for (const skillId of skillIds) {
      const versionId = skillVersion.get(skillId);
      if (!versionId) continue;
      const a = officialScores.get(skillId) ?? null;
      const b = secondScores.get(skillId) ?? null;
      if (a === null && b === null) continue;
      records.push({
        ratingId: rating.id,
        sessionId: rating.sessionId,
        participantId: rating.participantId,
        versionId,
        skillId,
        officialRaterId: official.evaluatorId,
        secondRaterId: rating.raterId,
        origin: rating.origin,
        official: a,
        second: b,
        status: a === null ? 'not_observed_official' : b === null ? 'not_observed_second' : 'pair',
        amendedAfter: rating.officialRevision !== null && official.revision > rating.officialRevision,
      });
    }
  }
  return { records, withoutOfficial, sameRater };
}

export type GroupStats = { id: string; label: string; stats: AgreementStats; observabilityMismatches: number };
export type FrequentGap = { skillId: string; skillName: string; official: number; second: number; count: number };
export type VersionReport = {
  version: DatasetVersion;
  overall: AgreementStats;
  observabilityMismatches: number;
  bySkill: GroupStats[];
  byRater: GroupStats[];
  /** Désaccords les plus fréquents (niveau officiel → niveau second), pour cibler l'étalonnage. */
  frequentGaps: FrequentGap[];
};
export type ReliabilityReport = {
  minPairs: number;
  submittedRatings: number;
  withoutOfficial: number;
  sameRater: number;
  amendedAfter: number;
  versions: VersionReport[];
};

function summarize(scale: Scale, records: PairRecord[], minPairs: number) {
  const pairs = records.filter((record) => record.status === 'pair').map((record) => ({ official: record.official!, second: record.second! }));
  return { stats: agreementStats(scale, pairs, minPairs), observabilityMismatches: records.filter((record) => record.status !== 'pair').length };
}

export function buildReliabilityReport(dataset: ReliabilityDataset, minPairs: number, gapsLimit = 10): ReliabilityReport {
  const { records, withoutOfficial, sameRater } = pairRatings(dataset);
  const skills = new Map(dataset.skills.map((skill) => [skill.id, skill]));
  const versions: VersionReport[] = [];
  for (const version of dataset.versions) {
    const own = records.filter((record) => record.versionId === version.id);
    if (own.length === 0) continue;
    const overall = summarize(version.scale, own, minPairs);

    const bySkill = [...new Set(own.map((record) => record.skillId))]
      .map((skillId) => ({ skill: skills.get(skillId)!, rows: own.filter((record) => record.skillId === skillId) }))
      .sort((a, b) => a.skill.position - b.skill.position || a.skill.name.localeCompare(b.skill.name, 'fr'))
      .map(({ skill, rows }) => ({ id: skill.id, label: skill.name, ...summarize(version.scale, rows, minPairs) }));

    const raterIds = [...new Set(own.flatMap((record) => [record.officialRaterId, record.secondRaterId]).filter((id): id is string => Boolean(id)))];
    const byRater = raterIds
      .map((raterId) => ({
        id: raterId,
        label: dataset.raterNames[raterId] ?? 'Compte supprimé',
        ...summarize(version.scale, own.filter((record) => record.officialRaterId === raterId || record.secondRaterId === raterId), minPairs),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

    const gaps = new Map<string, FrequentGap>();
    for (const record of own) {
      if (record.status !== 'pair' || record.official === record.second) continue;
      const id = `${record.skillId}:${record.official}:${record.second}`;
      const current = gaps.get(id) ?? { skillId: record.skillId, skillName: skills.get(record.skillId)?.name ?? 'Compétence', official: record.official!, second: record.second!, count: 0 };
      current.count += 1;
      gaps.set(id, current);
    }
    const frequentGaps = [...gaps.values()].sort((a, b) => b.count - a.count || a.skillName.localeCompare(b.skillName, 'fr')).slice(0, gapsLimit);

    versions.push({ version, overall: overall.stats, observabilityMismatches: overall.observabilityMismatches, bySkill, byRater, frequentGaps });
  }
  return {
    minPairs,
    submittedRatings: dataset.ratings.length,
    withoutOfficial,
    sameRater,
    amendedAfter: new Set(records.filter((record) => record.amendedAfter).map((record) => record.ratingId)).size,
    versions,
  };
}

// ── Publication sur la page publique « Notre méthode » ──────────────────────
export type PublicReliabilityRow = {
  framework: string;
  version: string;
  n: number;
  sufficient: boolean;
  exact: { rate: number; ci: [number, number] } | null;
  adjacent: { rate: number; ci: [number, number] } | null;
  kappa: { value: number; ci: [number, number] } | null;
};
export type PublicReliability = { computedAt: string; minPairs: number; rows: PublicReliabilityRow[] };

/** Instantané publiable : agrégats par version seulement (ni compétence, ni formateur, ni personne). */
export function publicSnapshot(report: ReliabilityReport, computedAt: string): PublicReliability {
  return {
    computedAt,
    minPairs: report.minPairs,
    rows: report.versions.map(({ version, overall }) => ({
      framework: version.frameworkName,
      version: version.label,
      n: overall.n,
      sufficient: overall.sufficient,
      exact: overall.sufficient && overall.exact.rate !== null && overall.exact.ci ? { rate: overall.exact.rate, ci: overall.exact.ci } : null,
      adjacent: overall.sufficient && overall.adjacent.rate !== null && overall.adjacent.ci ? { rate: overall.adjacent.rate, ci: overall.adjacent.ci } : null,
      kappa: overall.sufficient && overall.kappa.value !== null && overall.kappa.ci ? { value: overall.kappa.value, ci: overall.kappa.ci } : null,
    })),
  };
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isInterval = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 && value.every(isNumber);

function parseMeasure<K extends 'rate' | 'value'>(value: unknown, field: K): ({ [P in K]: number } & { ci: [number, number] }) | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!isNumber(record[field]) || !isInterval(record.ci)) return null;
  return { [field]: record[field], ci: record.ci } as { [P in K]: number } & { ci: [number, number] };
}

/** Relecture défensive de l'instantané stocké en base (jsonb). */
export function parsePublicReliability(value: unknown): PublicReliability | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.computedAt !== 'string' || !isNumber(record.minPairs) || !Array.isArray(record.rows)) return null;
  const rows: PublicReliabilityRow[] = [];
  for (const raw of record.rows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.framework !== 'string' || typeof row.version !== 'string' || !isNumber(row.n)) continue;
    const sufficient = row.sufficient === true && row.n >= record.minPairs;
    rows.push({
      framework: row.framework,
      version: row.version,
      n: row.n,
      sufficient,
      exact: sufficient ? parseMeasure(row.exact, 'rate') : null,
      adjacent: sufficient ? parseMeasure(row.adjacent, 'rate') : null,
      kappa: sufficient ? parseMeasure(row.kappa, 'value') : null,
    });
  }
  return { computedAt: record.computedAt, minPairs: record.minPairs, rows };
}
