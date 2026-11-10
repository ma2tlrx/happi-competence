/**
 * Moteur d'évaluation HAPPI — module pur, sans accès à la base.
 *
 * Il fait deux choses, entièrement pilotées par les règles de la version de
 * référentiel (table framework_versions) :
 *   1. dériver la note d'une compétence à partir de ses critères (scoring_mode) ;
 *   2. synthétiser les observations de plusieurs sessions (aggregation, rounding).
 *
 * Aucune règle pédagogique n'est codée en dur ici : le mode par défaut des
 * référentiels livrés est « direct » + « latest » (la note saisie, puis la
 * dernière observation), qui ne suppose ni moyenne ni pondération.
 */

export type ScoringMode = 'direct' | 'criteria_count' | 'criteria_average';
export type Aggregation = 'latest' | 'mean' | 'weighted_mean' | 'max';
export type Rounding = 'none' | 'half' | 'integer';

export type FrameworkRules = {
  scaleMin: number;
  scaleMax: number;
  scaleStep: number;
  scoringMode: ScoringMode;
  aggregation: Aggregation;
  rounding: Rounding;
};

export type ScaleLevel = { value: number; label: string; description?: string | null };

export const SCORING_MODE_LABELS: Record<ScoringMode, { label: string; description: string }> = {
  direct: {
    label: 'Niveau saisi par le formateur',
    description: 'Le formateur choisit directement le niveau de chaque compétence. Les critères servent de repères d’observation.',
  },
  criteria_count: {
    label: 'Nombre de critères observés',
    description: 'Le formateur coche les critères observés ; la note de la compétence est le nombre de critères cochés, bornée à l’échelle.',
  },
  criteria_average: {
    label: 'Moyenne pondérée des critères',
    description: 'Le formateur note chaque critère ; la note de la compétence est la moyenne des critères notés, pondérée par leur poids.',
  },
};

export const AGGREGATION_LABELS: Record<Aggregation, { label: string; description: string }> = {
  latest: {
    label: 'Dernière observation',
    description: 'La valeur affichée est celle de la dernière session où la compétence a été observée.',
  },
  mean: {
    label: 'Moyenne des observations',
    description: 'La valeur affichée est la moyenne simple de toutes les observations validées.',
  },
  weighted_mean: {
    label: 'Moyenne pondérée par session',
    description: 'Chaque observation compte selon le poids défini dans la correspondance session ↔ compétence.',
  },
  max: {
    label: 'Meilleure observation',
    description: 'La valeur affichée est la plus haute observation validée.',
  },
};

export const ROUNDING_LABELS: Record<Rounding, string> = {
  none: 'Aucun arrondi',
  half: 'Au demi-point',
  integer: 'À l’entier le plus proche',
};

export function applyRounding(value: number, rounding: Rounding): number {
  if (rounding === 'integer') return Math.round(value);
  if (rounding === 'half') return Math.round(value * 2) / 2;
  return Math.round(value * 100) / 100;
}

export function clampToScale(value: number, rules: Pick<FrameworkRules, 'scaleMin' | 'scaleMax'>): number {
  return Math.min(rules.scaleMax, Math.max(rules.scaleMin, value));
}

/** Valeurs sélectionnables sur l'échelle (ex. 1, 2, 3, 4, 5 ou 1, 1.5, 2…). */
export function scaleValues(rules: Pick<FrameworkRules, 'scaleMin' | 'scaleMax' | 'scaleStep'>): number[] {
  const step = rules.scaleStep > 0 ? rules.scaleStep : 1;
  const values: number[] = [];
  for (let value = rules.scaleMin; value <= rules.scaleMax + 1e-9; value += step) values.push(Math.round(value * 100) / 100);
  return values;
}

export type CriterionObservation = { weight: number; observed?: boolean | null; score?: number | null };

/**
 * Note d'une compétence calculée à partir de ses critères.
 * Renvoie null lorsque rien n'a été observé (la compétence reste « non observée »)
 * ou lorsque le mode de notation est « direct » (rien à calculer).
 */
export function deriveSkillScore(rules: FrameworkRules, criteria: CriterionObservation[]): number | null {
  if (rules.scoringMode === 'direct') return null;

  if (rules.scoringMode === 'criteria_count') {
    const observed = criteria.filter((criterion) => criterion.observed === true).length;
    if (observed < rules.scaleMin) return null;
    return clampToScale(observed, rules);
  }

  const rated = criteria.filter((criterion) => typeof criterion.score === 'number' && criterion.weight > 0);
  if (rated.length === 0) return null;
  const totalWeight = rated.reduce((sum, criterion) => sum + criterion.weight, 0);
  const weighted = rated.reduce((sum, criterion) => sum + (criterion.score as number) * criterion.weight, 0);
  return clampToScale(applyRounding(weighted / totalWeight, rules.rounding), rules);
}

/** Une note validée pour une compétence, lors d'une session. */
export type Observation = {
  skillCode: string;
  score: number;
  sessionNumber: number;
  /** Date de référence (date de la session, sinon date de validation), au format ISO. */
  date: string;
  /** Poids de la correspondance session ↔ compétence (1 par défaut). */
  weight?: number;
  evaluationId?: string;
  comment?: string | null;
};

export type Trend = 'up' | 'down' | 'stable';

export type SkillSummary = {
  skillCode: string;
  /** Valeur de synthèse selon la règle active ; null si la compétence n'a jamais été observée. */
  value: number | null;
  observations: Observation[];
  first: number | null;
  last: number | null;
  /** Écart entre la dernière et la première observation ; null avec moins de deux observations. */
  delta: number | null;
  trend: Trend | null;
};

function chronological(observations: Observation[]): Observation[] {
  return [...observations].sort((a, b) => a.date.localeCompare(b.date) || a.sessionNumber - b.sessionNumber);
}

export function aggregate(observations: Observation[], rules: Pick<FrameworkRules, 'aggregation' | 'rounding'>): number | null {
  if (observations.length === 0) return null;
  const ordered = chronological(observations);
  switch (rules.aggregation) {
    case 'latest':
      return ordered[ordered.length - 1]!.score;
    case 'max':
      return Math.max(...ordered.map((observation) => observation.score));
    case 'mean':
      return applyRounding(ordered.reduce((sum, observation) => sum + observation.score, 0) / ordered.length, rules.rounding);
    case 'weighted_mean': {
      const totalWeight = ordered.reduce((sum, observation) => sum + (observation.weight ?? 1), 0);
      if (totalWeight <= 0) return null;
      const weighted = ordered.reduce((sum, observation) => sum + observation.score * (observation.weight ?? 1), 0);
      return applyRounding(weighted / totalWeight, rules.rounding);
    }
  }
}

export function summarizeSkill(
  skillCode: string,
  observations: Observation[],
  rules: Pick<FrameworkRules, 'aggregation' | 'rounding'>,
): SkillSummary {
  const ordered = chronological(observations);
  const first = ordered[0]?.score ?? null;
  const last = ordered[ordered.length - 1]?.score ?? null;
  const delta = ordered.length >= 2 && first !== null && last !== null ? Math.round((last - first) * 100) / 100 : null;
  return {
    skillCode,
    value: aggregate(ordered, rules),
    observations: ordered,
    first,
    last,
    delta,
    trend: delta === null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
  };
}

/** Synthèse de toutes les compétences d'un référentiel, indexée par code de compétence. */
export function summarizeProfile(
  skillCodes: string[],
  observations: Observation[],
  rules: Pick<FrameworkRules, 'aggregation' | 'rounding'>,
): Map<string, SkillSummary> {
  const bySkill = new Map<string, Observation[]>();
  for (const observation of observations) {
    const list = bySkill.get(observation.skillCode);
    if (list) list.push(observation);
    else bySkill.set(observation.skillCode, [observation]);
  }
  return new Map(skillCodes.map((code) => [code, summarizeSkill(code, bySkill.get(code) ?? [], rules)]));
}

/** Niveau de l'échelle correspondant à une valeur (niveau atteint : arrondi à l'inférieur). */
export function levelFor(value: number | null | undefined, levels: ScaleLevel[]): ScaleLevel | null {
  if (value === null || value === undefined || levels.length === 0) return null;
  const ordered = [...levels].sort((a, b) => a.value - b.value);
  let match: ScaleLevel | null = null;
  for (const level of ordered) {
    if (value + 1e-9 >= level.value) match = level;
  }
  return match ?? ordered[0]!;
}

export type Highlights = {
  /** Compétences aux observations les plus élevées. */
  strengths: SkillSummary[];
  /** Compétences aux observations les plus basses : des pistes, pas des faiblesses. */
  toDevelop: SkillSummary[];
  /** Compétences dont la dernière observation dépasse la première. */
  progressions: SkillSummary[];
  /** Vrai lorsqu'il y a trop peu de compétences observées pour dégager des tendances. */
  insufficient: boolean;
};

/**
 * Points saillants d'un profil, sans rien inventer : en dessous de `minObserved`
 * compétences observées, aucune force ni piste n'est proposée.
 */
export function highlights(summaries: SkillSummary[], { count = 3, minObserved = 4 } = {}): Highlights {
  const observed = summaries.filter((summary) => summary.value !== null);
  const progressions = observed
    .filter((summary) => (summary.delta ?? 0) > 0)
    .sort((a, b) => (b.delta as number) - (a.delta as number))
    .slice(0, count);
  if (observed.length < minObserved) {
    return { strengths: [], toDevelop: [], progressions, insufficient: true };
  }
  const descending = [...observed].sort(
    (a, b) => (b.value as number) - (a.value as number) || b.observations.length - a.observations.length,
  );
  const strengths = descending.slice(0, count);
  const strengthCodes = new Set(strengths.map((summary) => summary.skillCode));
  const topValue = strengths[strengths.length - 1]?.value ?? null;
  const toDevelop = [...descending]
    .reverse()
    .filter((summary) => !strengthCodes.has(summary.skillCode) && (topValue === null || (summary.value as number) < topValue))
    .slice(0, count);
  return { strengths, toDevelop, progressions, insufficient: false };
}

/** Taux de présence : présents, en retard et départs anticipés comptent comme présents. */
export function attendanceRate(statuses: string[]): number | null {
  if (statuses.length === 0) return null;
  const attended = statuses.filter((status) => status === 'present' || status === 'late' || status === 'left_early').length;
  return (attended / statuses.length) * 100;
}
