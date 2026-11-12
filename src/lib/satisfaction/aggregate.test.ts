import { describe, expect, it } from 'vitest';

import { mean, recommendationIndex, responseRate, summarizeSatisfaction, type OverviewRow, type QuestionDef, type ResultRow } from './aggregate';

const questions: QuestionDef[] = [
  { id: 'q1', versionId: 'v1', versionLabel: 'Version 1', position: 1, kind: 'rating', text: 'Objectifs', options: [] },
  { id: 'q2', versionId: 'v1', versionLabel: 'Version 1', position: 2, kind: 'choice', text: 'Rythme', options: ['Trop lent', 'Adapté', 'Trop rapide'] },
  { id: 'q3', versionId: 'v1', versionLabel: 'Version 1', position: 3, kind: 'nps', text: 'Recommandation', options: [] },
  { id: 'q4', versionId: 'v1', versionLabel: 'Version 1', position: 4, kind: 'text', text: 'Commentaire', options: [] },
];

const row = (questionId: string, patch: Partial<ResultRow>): ResultRow => ({
  groupId: 'g1',
  audience: 'participant',
  moment: 'hot',
  questionId,
  value: null,
  choice: null,
  textValue: null,
  textHidden: false,
  ...patch,
});

const overview: OverviewRow[] = [
  { groupId: 'g1', audience: 'participant', moment: 'hot', invited: 8, responses: 3, isOpen: true, endDate: '2026-01-12' },
  { groupId: 'g2', audience: 'participant', moment: 'hot', invited: 4, responses: 0, isOpen: false, endDate: null },
  { groupId: 'g1', audience: 'prescriber', moment: 'hot', invited: 0, responses: 0, isOpen: true, endDate: '2026-01-12' },
];

describe('indicateurs', () => {
  it('moyenne arrondie au dixième, nulle sans réponse', () => {
    expect(mean([4, 5, 4])).toBe(4.3);
    expect(mean([])).toBeNull();
  });

  it('taux de réponse = réponses / invités, nul sans invité', () => {
    expect(responseRate(3, 12)).toBe(0.25);
    expect(responseRate(0, 0)).toBeNull();
    expect(responseRate(5, 4)).toBe(1);
  });

  it('indice de recommandation : part des 9–10 moins part des 0–6', () => {
    expect(recommendationIndex([10, 9, 8, 6])).toBe(25);
    expect(recommendationIndex([])).toBeNull();
  });
});

describe('synthèse', () => {
  const rows = [
    row('q1', { value: 4 }),
    row('q1', { value: 5 }),
    row('q1', { value: 4 }),
    row('q2', { choice: 'Adapté' }),
    row('q2', { choice: 'Adapté' }),
    row('q2', { choice: 'Trop rapide' }),
    row('q3', { value: 10 }),
    row('q3', { value: 7 }),
    row('q4', { textValue: 'Très bien.' }),
    row('q4', { textValue: null, textHidden: true }),
  ];
  const blocks = summarizeSatisfaction(questions, rows, overview);
  const hot = blocks.find((block) => block.audience === 'participant' && block.moment === 'hot')!;

  it('additionne invités et réponses des groupes et calcule le taux', () => {
    expect(hot).toMatchObject({ invited: 12, responses: 3, rate: 0.25, groupsOpen: 1 });
  });

  it('donne chaque moyenne avec son effectif et sa répartition', () => {
    const rating = hot.questions.find((summary) => summary.question.id === 'q1')!;
    expect(rating).toMatchObject({ n: 3, mean: 4.3 });
    expect(rating.distribution.map((item) => item.count)).toEqual([0, 0, 0, 2, 1]);
    const nps = hot.questions.find((summary) => summary.question.id === 'q3')!;
    expect(nps).toMatchObject({ n: 2, mean: 8.5, recommendationIndex: 50 });
    expect(nps.distribution).toHaveLength(11);
  });

  it('compte les options d’un choix unique', () => {
    const choice = hot.questions.find((summary) => summary.question.id === 'q2')!;
    expect(choice.n).toBe(3);
    expect(choice.distribution.map((item) => [item.key, item.count])).toEqual([['Trop lent', 0], ['Adapté', 2], ['Trop rapide', 1]]);
  });

  it('restitue les verbatims sans auteur et compte les verbatims masqués', () => {
    const text = hot.questions.find((summary) => summary.question.id === 'q4')!;
    expect(text.verbatims).toEqual([{ text: 'Très bien.', respondent: null, groupId: 'g1' }]);
    expect(text.hiddenVerbatims).toBe(1);
  });

  it('ordonne les questions selon l’enquête et laisse vides les blocs sans réponse', () => {
    expect(hot.questions.map((summary) => summary.question.id)).toEqual(['q1', 'q2', 'q3', 'q4']);
    const prescriber = blocks.find((block) => block.audience === 'prescriber' && block.moment === 'hot')!;
    expect(prescriber).toMatchObject({ invited: 0, responses: 0, rate: null, questions: [] });
  });

  it('compte les réponses sur les lignes quand une période est filtrée', () => {
    const filtered = summarizeSatisfaction(questions, [row('q1', { value: 3, responseId: 'r1' }), row('q2', { choice: 'Adapté', responseId: 'r1' })], overview, { responsesFromRows: true });
    expect(filtered.find((block) => block.audience === 'participant' && block.moment === 'hot')).toMatchObject({ responses: 1, invited: 12 });
  });
});
