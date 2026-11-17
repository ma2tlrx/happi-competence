/**
 * Indicateurs qualité — calculs purs, sans accès à la base.
 *
 * Règles : chaque taux est donné avec son effectif (n) ; sans effectif, le taux vaut null
 * (affiché « — »), jamais zéro. Une donnée manquante n'est jamais comptée comme un échec.
 */
import type { ImpactIndicators } from '@/lib/outcomes/impact';
import type { SatisfactionSummary } from '@/lib/satisfaction/aggregate';

import {
  DEFAULT_TRAINING_MAX_AGE_MONTHS,
  OPEN_ACTION_STATUSES,
  OPEN_COMPLAINT_STATUSES,
  PUBLIC_MIN_N,
  type ActionStatus,
  type ComplaintSource,
  type ComplaintStatus,
} from './labels';

export type Rate = { count: number; n: number; rate: number | null };

export function rate(count: number, n: number): Rate {
  return { count, n, rate: n > 0 ? (count / n) * 100 : null };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nombre de jours entre deux dates AAAA-MM-JJ (calcul en UTC). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Retire des mois à une date AAAA-MM-JJ (fin de mois ramenée au dernier jour valide). */
export function subtractMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function inPeriod(date: string | null | undefined, period: { from?: string | null; to?: string | null }) {
  if (!date) return false;
  const day = date.slice(0, 10);
  return (!period.from || day >= period.from) && (!period.to || day <= period.to);
}

// ── Réclamations ─────────────────────────────────────────────────────────────
export type ComplaintFacts = { status: ComplaintStatus | string; source: ComplaintSource | string; receivedOn: string; respondedOn: string | null };

/** Délai de traitement en jours (réception → réponse) ; null tant qu'aucune réponse n'est datée. */
export function complaintDelay(complaint: Pick<ComplaintFacts, 'receivedOn' | 'respondedOn'>): number | null {
  if (!complaint.respondedOn) return null;
  return Math.max(0, daysBetween(complaint.receivedOn, complaint.respondedOn));
}

/** Ancienneté d'une réclamation sans réponse, en jours. */
export function complaintAge(complaint: Pick<ComplaintFacts, 'receivedOn' | 'respondedOn'>, today: string): number | null {
  if (complaint.respondedOn) return null;
  return Math.max(0, daysBetween(complaint.receivedOn, today));
}

export type ComplaintStats = {
  total: number;
  open: number;
  answered: number;
  /** Délai moyen de réponse, en jours, sur les réclamations répondues (n = answered). */
  meanDelayDays: number | null;
  maxDelayDays: number | null;
  bySource: Record<string, number>;
};

export function complaintStats(complaints: ComplaintFacts[]): ComplaintStats {
  const delays = complaints.map(complaintDelay).filter((value): value is number => value !== null);
  const bySource: Record<string, number> = {};
  for (const complaint of complaints) bySource[complaint.source] = (bySource[complaint.source] ?? 0) + 1;
  return {
    total: complaints.length,
    open: complaints.filter((complaint) => (OPEN_COMPLAINT_STATUSES as readonly string[]).includes(complaint.status)).length,
    answered: delays.length,
    meanDelayDays: delays.length ? Math.round((delays.reduce((sum, value) => sum + value, 0) / delays.length) * 10) / 10 : null,
    maxDelayDays: delays.length ? Math.max(...delays) : null,
    bySource,
  };
}

// ── Plan d'amélioration ──────────────────────────────────────────────────────
export type ActionFacts = { status: ActionStatus | string; dueOn: string | null; effectiveness: string | null };

export function isOverdue(action: Pick<ActionFacts, 'status' | 'dueOn'>, today: string) {
  return (OPEN_ACTION_STATUSES as readonly string[]).includes(action.status) && Boolean(action.dueOn) && action.dueOn! < today;
}

export type ActionStats = { total: number; open: number; closed: number; overdue: number; done: number; effectivenessRecorded: Rate };

export function actionStats(actions: ActionFacts[], today: string): ActionStats {
  const done = actions.filter((action) => action.status === 'done');
  const open = actions.filter((action) => (OPEN_ACTION_STATUSES as readonly string[]).includes(action.status)).length;
  return {
    total: actions.length,
    open,
    closed: actions.length - open,
    overdue: actions.filter((action) => isOverdue(action, today)).length,
    done: done.length,
    effectivenessRecorded: rate(done.filter((action) => Boolean(action.effectiveness?.trim())).length, done.length),
  };
}

/** Actions d'une période : créées pendant celle-ci, ou créées avant et encore ouvertes à son début. */
export function actionsInPeriod<T extends { createdAt: string; closedOn: string | null }>(actions: T[], period: { from: string; to: string }): T[] {
  return actions.filter((action) => {
    const created = action.createdAt.slice(0, 10);
    return created <= period.to && (created >= period.from || !action.closedOn || action.closedOn >= period.from);
  });
}

// ── Registre des intervenants ────────────────────────────────────────────────
export type QualificationFacts = { kind: string; completedOn: string | null; startedOn: string | null; isAiTraining: boolean };

export type TrainingState = 'up_to_date' | 'outdated' | 'none';

export type TrainerTrainingStatus = {
  state: TrainingState;
  /** Date de la formation suivie la plus récente (fin, à défaut début). */
  lastTrainingOn: string | null;
  /** Date limite en deçà de laquelle une formation est considérée ancienne. */
  threshold: string;
  aiTraining: boolean;
  lastAiTrainingOn: string | null;
};

const trainingDate = (row: QualificationFacts) => row.completedOn ?? row.startedOn;

/**
 * Formation continue d'un intervenant : « à jour » si sa formation suivie la plus récente date
 * de moins de `maxAgeMonths` mois (seuil paramétrable, 24 mois par défaut — à valider).
 */
export function trainerTrainingStatus(rows: QualificationFacts[], today: string, maxAgeMonths = DEFAULT_TRAINING_MAX_AGE_MONTHS): TrainerTrainingStatus {
  const trainings = rows.filter((row) => row.kind === 'formation' && trainingDate(row) && trainingDate(row)! <= today);
  const last = trainings.map(trainingDate).sort().at(-1) ?? null;
  const ai = trainings.filter((row) => row.isAiTraining).map(trainingDate).sort().at(-1) ?? null;
  const threshold = subtractMonths(today, maxAgeMonths);
  return {
    state: last === null ? 'none' : last >= threshold ? 'up_to_date' : 'outdated',
    lastTrainingOn: last,
    threshold,
    aiTraining: ai !== null,
    lastAiTrainingOn: ai,
  };
}

export function parseMaxAgeMonths(value: unknown): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isInteger(number) && number >= 1 && number <= 120 ? number : DEFAULT_TRAINING_MAX_AGE_MONTHS;
}

// ── Satisfaction ─────────────────────────────────────────────────────────────
export type SatisfactionRate = Rate & { respondents: number; invited: number };

/**
 * Taux de satisfaction : part des notes 4 ou 5 aux questions notées de 1 à 5, pour une enquête
 * (destinataire, moment). n = nombre de notes ; respondents = nombre de répondants.
 * Mode de calcul provisoire — à valider.
 */
export function satisfactionRate(
  summaries: SatisfactionSummary[],
  audience: SatisfactionSummary['audience'] = 'participant',
  moment: SatisfactionSummary['moment'] = 'hot',
): SatisfactionRate {
  const block = summaries.find((summary) => summary.audience === audience && summary.moment === moment);
  let positive = 0;
  let answers = 0;
  for (const question of block?.questions ?? []) {
    if (question.question.kind !== 'rating') continue;
    for (const bucket of question.distribution) {
      answers += bucket.count;
      if (bucket.key === '4' || bucket.key === '5') positive += bucket.count;
    }
  }
  return { ...rate(positive, answers), respondents: block?.responses ?? 0, invited: block?.invited ?? 0 };
}

// ── Synthèse et publication ──────────────────────────────────────────────────
export type QualitySnapshot = {
  satisfaction: SatisfactionRate;
  impact: Pick<ImpactIndicators, 'enrolled' | 'dropped' | 'dropRate' | 'attendance'>;
};

export type PublicIndicator = { status: 'published'; value: number; n: number } | { status: 'insufficient' };

export type PublicIndicators = {
  participants: PublicIndicator;
  completion: PublicIndicator;
  attendance: PublicIndicator;
  satisfaction: PublicIndicator;
};

const published = (value: number | null, n: number, enough: boolean): PublicIndicator =>
  enough && value !== null ? { status: 'published', value: Math.round(value), n } : { status: 'insufficient' };

/**
 * Indicateurs publiables : un indicateur n'est publié que si son effectif atteint PUBLIC_MIN_N.
 * Sous le seuil, rien n'est conservé (ni valeur, ni effectif) : la page publique affiche
 * « pas encore assez de données ».
 */
export function publicIndicators(snapshot: QualitySnapshot, minN = PUBLIC_MIN_N): PublicIndicators {
  const { enrolled, dropped, attendance } = snapshot.impact;
  const enoughJourneys = enrolled >= minN;
  return {
    participants: published(enrolled, enrolled, enoughJourneys),
    completion: published(rate(enrolled - dropped, enrolled).rate, enrolled, enoughJourneys),
    attendance: published(attendance.rate, enrolled, enoughJourneys && attendance.n >= minN),
    satisfaction: published(snapshot.satisfaction.rate, snapshot.satisfaction.respondents, snapshot.satisfaction.respondents >= minN),
  };
}

/** Lecture défensive d'un instantané publié (JSON stocké en base). */
export function parsePublicIndicators(value: unknown): PublicIndicators | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const one = (key: string): PublicIndicator => {
    const item = record[key] as { status?: unknown; value?: unknown; n?: unknown } | undefined;
    if (item?.status === 'published' && typeof item.value === 'number' && typeof item.n === 'number' && item.n >= PUBLIC_MIN_N) {
      return { status: 'published', value: item.value, n: item.n };
    }
    return { status: 'insufficient' };
  };
  return { participants: one('participants'), completion: one('completion'), attendance: one('attendance'), satisfaction: one('satisfaction') };
}

/** Pourcentage lisible avec son effectif. */
export function formatRate(value: Pick<Rate, 'rate' | 'n'>) {
  return `${value.rate === null ? '—' : `${Math.round(value.rate)} %`} (n = ${value.n})`;
}
