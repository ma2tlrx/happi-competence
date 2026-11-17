import { describe, expect, it } from 'vitest';

import { checkConsistency, commentTone } from './consistency';

const scale5 = { scaleMin: 1, scaleMax: 5 };
const scale4 = { scaleMin: 1, scaleMax: 4 };

describe('ton d’un commentaire', () => {
  it('repère les termes positifs et négatifs, et les tournures qui les annulent', () => {
    expect(commentTone('Excellent travail, très à l’aise').positive).toBeGreaterThanOrEqual(3);
    expect(commentTone('A du mal à s’organiser, reste en retrait').negative).toBe(2);
    expect(commentTone('Sans difficulté pour lancer la partie')).toEqual({ positive: 1, negative: 0 });
    expect(commentTone('Pas autonome sur cette activité')).toEqual({ positive: 0, negative: 1 });
  });
});

describe('incohérence commentaire / niveau (sans IA)', () => {
  it('avertit pour un commentaire très positif avec un niveau bas', () => {
    expect(checkConsistency({ comment: 'Excellent, a fédéré tout le groupe.', score: 1, ...scale5 })?.kind).toBe('positive_low');
    expect(checkConsistency({ comment: 'Remarquable.', score: 2, ...scale4 })?.kind).toBe('positive_low');
  });

  it('avertit pour un commentaire très réservé avec un niveau élevé', () => {
    expect(checkConsistency({ comment: 'Reste en retrait, ne participe pas aux échanges.', score: 5, ...scale5 })?.kind).toBe('negative_high');
    expect(checkConsistency({ comment: 'Très peu d’initiative.', score: 3, ...scale4 })?.kind).toBe('negative_high');
  });

  it('ne dit rien quand ton et niveau concordent, ou sans niveau, ou avec un commentaire nuancé', () => {
    expect(checkConsistency({ comment: 'Excellent, très à l’aise.', score: 5, ...scale5 })).toBeNull();
    expect(checkConsistency({ comment: 'Excellent, très à l’aise.', score: 3, ...scale5 })).toBeNull();
    expect(checkConsistency({ comment: 'Excellent.', score: null, ...scale5 })).toBeNull();
    expect(checkConsistency({ comment: 'Très efficace, mais en retrait au début.', score: 1, ...scale5 })).toBeNull();
    expect(checkConsistency({ comment: '', score: 1, ...scale5 })).toBeNull();
    expect(checkConsistency({ comment: 'A participé à la partie.', score: 1, ...scale5 })).toBeNull();
  });
});
