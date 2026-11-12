import { describe, expect, it } from 'vitest';

import { parseQuestions, serializeQuestions } from './questions-format';

describe('saisie des questions', () => {
  it('lit les quatre types et les questions facultatives', () => {
    const { questions, errors } = parseQuestions(
      'note | Objectifs atteints ?\nchoix | Le rythme était… | Trop lent ; Adapté ; Trop rapide\n\nrecommandation | Recommanderiez-vous ?\ntexte? | Un commentaire ?',
    );
    expect(errors).toEqual([]);
    expect(questions).toEqual([
      { position: 1, kind: 'rating', text: 'Objectifs atteints ?', options: [], isRequired: true },
      { position: 2, kind: 'choice', text: 'Le rythme était…', options: ['Trop lent', 'Adapté', 'Trop rapide'], isRequired: true },
      { position: 3, kind: 'nps', text: 'Recommanderiez-vous ?', options: [], isRequired: true },
      { position: 4, kind: 'text', text: 'Un commentaire ?', options: [], isRequired: false },
    ]);
  });

  it('signale les lignes invalides', () => {
    expect(parseQuestions('sondage | Question').errors[0]).toMatch(/Ligne 1.*inconnu/);
    expect(parseQuestions('choix | Une seule option | Oui').errors[0]).toMatch(/entre 2 et 10 options/);
    expect(parseQuestions('note | x').errors[0]).toMatch(/entre 2 et 400/);
    expect(parseQuestions('   \n').errors).toEqual(['Ajoutez au moins une question.']);
  });

  it('reproduit la saisie à partir des questions enregistrées', () => {
    const source = 'note | Objectifs atteints ?\nchoix | Rythme | Lent ; Adapté\ntexte? | Commentaire';
    const { questions } = parseQuestions(source);
    expect(serializeQuestions(questions.map((question) => ({ ...question, is_required: question.isRequired })))).toBe(source);
  });
});
