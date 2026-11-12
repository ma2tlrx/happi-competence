/**
 * Agrégats des enquêtes de satisfaction — module pur.
 *
 * Toute moyenne est accompagnée de son effectif (n) ; un taux de réponse se calcule sur
 * les invités (réponses / invités). Les verbatims sont restitués sans auteur, sauf pour
 * l'administrateur (la base ne renvoie l'auteur qu'à lui).
 */
import type { SatisfactionAudience, SatisfactionMoment } from './window';

export type QuestionKind = 'rating' | 'choice' | 'text' | 'nps';

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  rating: 'Note de 1 à 5',
  choice: 'Choix unique',
  text: 'Texte libre',
  nps: 'Recommandation de 0 à 10',
};

export type QuestionDef = {
  id: string;
  versionId: string;
  versionLabel: string;
  position: number;
  kind: QuestionKind;
  text: string;
  options: string[];
  ratingLabels?: string[];
};

export type ResultRow = {
  groupId: string;
  audience: SatisfactionAudience;
  moment: SatisfactionMoment;
  questionId: string;
  value: number | null;
  choice: string | null;
  textValue: string | null;
  textHidden: boolean;
  responseId?: string | null;
  submittedAt?: string | null;
  respondent?: string | null;
};

export type OverviewRow = {
  groupId: string;
  audience: SatisfactionAudience;
  moment: SatisfactionMoment;
  invited: number;
  responses: number;
  isOpen: boolean;
  endDate: string | null;
};

export type Verbatim = { text: string; respondent: string | null; groupId: string };

export type QuestionSummary = {
  question: QuestionDef;
  /** Nombre de réponses à cette question. */
  n: number;
  /** Moyenne (notes et recommandation), arrondie au dixième ; nulle sans réponse. */
  mean: number | null;
  /** Répartition des réponses : une entrée par valeur de l'échelle ou par option. */
  distribution: { key: string; label: string; count: number }[];
  /** Indice de recommandation (part des 9–10 moins part des 0–6), en points ; nul sans réponse. */
  recommendationIndex: number | null;
  verbatims: Verbatim[];
  /** Commentaires existants mais non restitués (moins de 3 réponses : anonymat). */
  hiddenVerbatims: number;
};

export type SatisfactionSummary = {
  audience: SatisfactionAudience;
  moment: SatisfactionMoment;
  invited: number;
  responses: number;
  /** Réponses / invités, entre 0 et 1 ; nul s'il n'y a aucun invité. */
  rate: number | null;
  groupsOpen: number;
  questions: QuestionSummary[];
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function responseRate(responses: number, invited: number): number | null {
  if (invited <= 0) return null;
  return Math.min(1, responses / invited);
}

export function recommendationIndex(values: number[]): number | null {
  if (values.length === 0) return null;
  const promoters = values.filter((value) => value >= 9).length;
  const detractors = values.filter((value) => value <= 6).length;
  return Math.round(((promoters - detractors) / values.length) * 100);
}

export const DEFAULT_RATING_LABELS = ['Pas du tout', 'Peu', 'Moyennement', 'Plutôt', 'Tout à fait'];

function summarizeQuestion(question: QuestionDef, rows: ResultRow[]): QuestionSummary {
  const values = rows.map((row) => row.value).filter((value): value is number => typeof value === 'number');
  let distribution: QuestionSummary['distribution'] = [];
  if (question.kind === 'rating') {
    const labels = question.ratingLabels?.length === 5 ? question.ratingLabels : DEFAULT_RATING_LABELS;
    distribution = [1, 2, 3, 4, 5].map((value) => ({ key: String(value), label: `${value} · ${labels[value - 1]}`, count: values.filter((v) => v === value).length }));
  } else if (question.kind === 'nps') {
    distribution = Array.from({ length: 11 }, (_, value) => ({ key: String(value), label: String(value), count: values.filter((v) => v === value).length }));
  } else if (question.kind === 'choice') {
    const choices = rows.map((row) => row.choice).filter((choice): choice is string => Boolean(choice));
    const known = question.options.map((option) => ({ key: option, label: option, count: choices.filter((choice) => choice === option).length }));
    // Une option retirée d'une version reste comptée, à part.
    const others = choices.filter((choice) => !question.options.includes(choice));
    distribution = others.length ? [...known, { key: '__autre', label: 'Autre option', count: others.length }] : known;
  }
  const texts = question.kind === 'text' ? rows : [];
  return {
    question,
    n: question.kind === 'text' ? texts.length : question.kind === 'choice' ? rows.filter((row) => row.choice).length : values.length,
    mean: question.kind === 'rating' || question.kind === 'nps' ? mean(values) : null,
    distribution,
    recommendationIndex: question.kind === 'nps' ? recommendationIndex(values) : null,
    verbatims: texts
      .filter((row) => row.textValue && row.textValue.trim())
      .map((row) => ({ text: row.textValue!.trim(), respondent: row.respondent ?? null, groupId: row.groupId })),
    hiddenVerbatims: texts.filter((row) => row.textHidden).length,
  };
}

/**
 * Synthèse par destinataire et par moment. `responsesFromRows` : compter les réponses à partir
 * des lignes (administrateur filtrant une période) plutôt qu'à partir de la vue d'ensemble.
 */
export function summarizeSatisfaction(
  questions: QuestionDef[],
  rows: ResultRow[],
  overview: OverviewRow[],
  { responsesFromRows = false }: { responsesFromRows?: boolean } = {},
): SatisfactionSummary[] {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const blocks: SatisfactionSummary[] = [];
  for (const audience of ['participant', 'prescriber'] as const) {
    for (const moment of ['hot', 'cold'] as const) {
      const scoped = rows.filter((row) => row.audience === audience && row.moment === moment);
      const groups = overview.filter((row) => row.audience === audience && row.moment === moment);
      const invited = groups.reduce((sum, row) => sum + row.invited, 0);
      const responses = responsesFromRows
        ? new Set(scoped.map((row) => row.responseId).filter(Boolean)).size
        : groups.reduce((sum, row) => sum + row.responses, 0);
      const questionIds = [...new Set(scoped.map((row) => row.questionId))].filter((id) => byId.has(id));
      const summaries = questionIds
        .map((id) => byId.get(id)!)
        .sort((a, b) => a.versionLabel.localeCompare(b.versionLabel, 'fr', { numeric: true }) || a.position - b.position)
        .map((question) => summarizeQuestion(question, scoped.filter((row) => row.questionId === question.id)));
      blocks.push({
        audience,
        moment,
        invited,
        responses,
        rate: responseRate(responses, invited),
        groupsOpen: groups.filter((row) => row.isOpen).length,
        questions: summaries,
      });
    }
  }
  return blocks;
}
