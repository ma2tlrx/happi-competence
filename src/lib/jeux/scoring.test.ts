import { describe, expect, it } from 'vitest';

import { calculatePoints, getLeaderboard, getQuestionStats, isWithinTime } from './scoring';

describe('calculatePoints', () => {
  it('donne 1000 points pour une réponse immédiate et 500 au dernier instant', () => {
    expect(calculatePoints(0, 20, true)).toBe(1000);
    expect(calculatePoints(20_000, 20, true)).toBe(500);
  });
  it('est proportionnel au temps écoulé', () => {
    expect(calculatePoints(10_000, 20, true)).toBe(750);
    expect(calculatePoints(5_000, 20, true)).toBe(875);
  });
  it('plafonne à 500 après la fin du temps et ne descend jamais sous 500 pour une bonne réponse', () => {
    expect(calculatePoints(60_000, 20, true)).toBe(500);
  });
  it('donne 0 pour une mauvaise réponse', () => {
    expect(calculatePoints(0, 20, false)).toBe(0);
  });
  it('ignore un temps négatif (horloge décalée)', () => {
    expect(calculatePoints(-500, 20, true)).toBe(1000);
  });
});

describe('isWithinTime', () => {
  it('accepte jusqu’à la fin du temps plus la marge réseau', () => {
    expect(isWithinTime(20_000, 20)).toBe(true);
    expect(isWithinTime(21_999, 20)).toBe(true);
    expect(isWithinTime(22_001, 20)).toBe(false);
  });
});

describe('getLeaderboard', () => {
  it('classe par score décroissant et numérote les rangs', () => {
    const board = getLeaderboard({
      a: { id: 'a', nickname: 'Ana', score: 500 },
      b: { id: 'b', nickname: 'Ben', score: 1500 },
      c: { id: 'c', nickname: 'Cléo', score: 900 },
    });
    expect(board.map((e) => [e.rank, e.nickname])).toEqual([[1, 'Ben'], [2, 'Cléo'], [3, 'Ana']]);
  });
  it('ne contient ni jeton ni empreinte', () => {
    const [entry] = getLeaderboard({ a: { id: 'a', nickname: 'Ana', score: 1, tokenHash: 'secret' } });
    expect(Object.keys(entry).sort()).toEqual(['id', 'nickname', 'rank', 'score']);
  });
});

describe('getQuestionStats', () => {
  it('compte les réponses par proposition', () => {
    const stats = getQuestionStats(
      {
        p1: { answerId: 'a', responseTime: 1, isCorrect: true, points: 1 },
        p2: { answerId: 'a', responseTime: 1, isCorrect: true, points: 1 },
        p3: { answerId: 'b', responseTime: 1, isCorrect: false, points: 0 },
      },
      ['a', 'b', 'c'],
    );
    expect(stats).toEqual({ answerCounts: { a: 2, b: 1, c: 0 }, totalAnswered: 3 });
  });
});
