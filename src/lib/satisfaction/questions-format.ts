/**
 * Saisie des questions d'une enquête par l'administrateur, une question par ligne :
 *
 *   note | Les objectifs ont-ils été atteints ?
 *   choix | Le rythme des séances était… | Trop lent ; Adapté ; Trop rapide
 *   recommandation | Recommanderiez-vous ce programme ?
 *   texte? | Un commentaire, une suggestion ?
 *
 * Un « ? » après le type rend la question facultative. Module pur.
 */
import type { QuestionKind } from './aggregate';

export type DraftQuestion = { position: number; kind: QuestionKind; text: string; options: string[]; isRequired: boolean };

const KIND_BY_WORD: Record<string, QuestionKind> = {
  note: 'rating',
  choix: 'choice',
  texte: 'text',
  recommandation: 'nps',
};
const WORD_BY_KIND: Record<QuestionKind, string> = { rating: 'note', choice: 'choix', text: 'texte', nps: 'recommandation' };

export const MAX_QUESTIONS = 30;

export function parseQuestions(source: string): { questions: DraftQuestion[]; errors: string[] } {
  const questions: DraftQuestion[] = [];
  const errors: string[] = [];
  const lines = source.split(/\r?\n/).map((line) => line.trim());
  lines.forEach((line, index) => {
    if (!line) return;
    const label = `Ligne ${index + 1}`;
    const [rawKind = '', rawText = '', rawOptions = ''] = line.split('|').map((part) => part.trim());
    const optional = rawKind.endsWith('?');
    const word = rawKind.replace(/\?$/, '').trim().toLowerCase();
    const kind = KIND_BY_WORD[word];
    if (!kind) {
      errors.push(`${label} : type « ${rawKind || '—'} » inconnu (note, choix, texte ou recommandation).`);
      return;
    }
    if (rawText.length < 2 || rawText.length > 400) {
      errors.push(`${label} : l’intitulé doit compter entre 2 et 400 caractères.`);
      return;
    }
    const options = kind === 'choice' ? [...new Set(rawOptions.split(';').map((option) => option.trim()).filter(Boolean))] : [];
    if (kind === 'choice' && (options.length < 2 || options.length > 10)) {
      errors.push(`${label} : un choix unique propose entre 2 et 10 options, séparées par « ; ».`);
      return;
    }
    if (options.some((option) => option.length > 200)) {
      errors.push(`${label} : une option dépasse 200 caractères.`);
      return;
    }
    questions.push({ position: questions.length + 1, kind, text: rawText, options, isRequired: !optional });
  });
  if (questions.length > MAX_QUESTIONS) errors.push(`Une enquête compte au plus ${MAX_QUESTIONS} questions.`);
  if (questions.length === 0 && errors.length === 0) errors.push('Ajoutez au moins une question.');
  return { questions, errors };
}

export function serializeQuestions(questions: { kind: string; text: string; options: string[]; is_required: boolean }[]): string {
  return questions
    .map((question) => {
      const word = WORD_BY_KIND[question.kind as QuestionKind] ?? 'note';
      const head = `${word}${question.is_required ? '' : '?'} | ${question.text}`;
      return question.kind === 'choice' ? `${head} | ${question.options.join(' ; ')}` : head;
    })
    .join('\n');
}
