import { describe, expect, it } from 'vitest';

import {
  endGame,
  endQuestion,
  joinLobby,
  newQuizState,
  nextQuestion,
  publicQuizState,
  revealAnswers,
  showQuestion,
  startGame,
  submitAnswer,
  type QuizQuestion,
  type QuizState,
} from './quiz-engine';

const questions: QuizQuestion[] = [
  {
    id: 'q1',
    text: 'Capitale de la France ?',
    type: 'multiple_choice',
    timeLimit: 20,
    answers: [
      { id: 'a1', text: 'Paris', isCorrect: true },
      { id: 'a2', text: 'Lyon', isCorrect: false },
    ],
  },
  {
    id: 'q2',
    text: 'Deux et deux ?',
    type: 'true_false',
    timeLimit: 10,
    answers: [
      { id: 'b1', text: 'Quatre', isCorrect: true },
      { id: 'b2', text: 'Cinq', isCorrect: false },
    ],
  },
];

function lobby(max = 10): QuizState {
  return newQuizState('s1', questions, max);
}
const join = (s: QuizState, id: string, nickname = id) => joinLobby(s, { id, nickname, tokenHash: `hash-${id}` });

function answering(): QuizState {
  const s = lobby();
  join(s, 'p1');
  join(s, 'p2');
  startGame(s);
  showQuestion(s, 0);
  revealAnswers(s, 10_000);
  return s;
}

describe('salle d’attente', () => {
  it('accepte un joueur et refuse un pseudo déjà pris (sans tenir compte de la casse)', () => {
    const s = lobby();
    expect(join(s, 'p1', 'Ana').ok).toBe(true);
    expect(join(s, 'p2', 'ANA')).toEqual({ ok: false, code: 'nickname_taken' });
  });
  it('refuse au-delà du maximum de joueurs', () => {
    const s = lobby(2);
    join(s, 'p1');
    join(s, 'p2');
    expect(join(s, 'p3')).toEqual({ ok: false, code: 'full' });
  });
  it('est idempotent avec le même jeton, refuse un autre jeton pour le même identifiant', () => {
    const s = lobby();
    join(s, 'p1');
    expect(join(s, 'p1')).toMatchObject({ ok: true, result: { rejoined: true } });
    expect(joinLobby(s, { id: 'p1', nickname: 'x', tokenHash: 'autre' })).toEqual({ ok: false, code: 'forbidden' });
  });
  it('refuse une entrée une fois la partie lancée', () => {
    const s = lobby();
    join(s, 'p1');
    startGame(s);
    expect(join(s, 'p2')).toEqual({ ok: false, code: 'already_started' });
  });
  it('ne démarre pas sans joueur', () => {
    expect(startGame(lobby())).toEqual({ ok: false, code: 'no_players' });
  });
});

describe('déroulé d’une question', () => {
  it('suit lobby → starting → question_show → answering → review', () => {
    const s = lobby();
    join(s, 'p1');
    expect(startGame(s).ok).toBe(true);
    expect(s.status).toBe('starting');
    expect(showQuestion(s, 0).ok).toBe(true);
    expect(s.status).toBe('question_show');
    expect(revealAnswers(s, 5)).toMatchObject({ ok: true, result: { remainingTime: 20 } });
    expect(s.status).toBe('answering');
    expect(endQuestion(s).ok).toBe(true);
    expect(s.status).toBe('review');
  });
  it('un double clic sur « afficher les réponses » ne relance pas le chronomètre', () => {
    const s = answering();
    expect(s.questionStartTime).toBe(10_000);
    expect(revealAnswers(s, 15_000)).toEqual({ ok: false, code: 'bad_phase' });
    expect(s.questionStartTime).toBe(10_000);
  });
  it('refuse une question inexistante', () => {
    const s = lobby();
    join(s, 'p1');
    startGame(s);
    expect(showQuestion(s, 9)).toEqual({ ok: false, code: 'not_found' });
  });
  it('ne montre pas de question dans le salon', () => {
    expect(showQuestion(lobby(), 0)).toEqual({ ok: false, code: 'bad_phase' });
  });
});

describe('réponses', () => {
  it('marque et score une bonne réponse', () => {
    const s = answering();
    const r = submitAnswer(s, 'p1', 'a1', 10_000);
    expect(r).toMatchObject({ ok: true, result: { isCorrect: true, points: 1000, totalScore: 1000, answerCount: 1, playerCount: 2, ended: null } });
  });
  it('0 point pour une mauvaise réponse', () => {
    const s = answering();
    expect(submitAnswer(s, 'p1', 'a2', 12_000)).toMatchObject({ ok: true, result: { isCorrect: false, points: 0 } });
  });
  it('refuse une seconde réponse du même joueur', () => {
    const s = answering();
    submitAnswer(s, 'p1', 'a1', 10_100);
    expect(submitAnswer(s, 'p1', 'a2', 10_200)).toEqual({ ok: false, code: 'already_answered' });
    expect(s.players.p1.score).toBeGreaterThan(900);
  });
  it('refuse hors phase de réponse, joueur inconnu, réponse inexistante et réponse tardive', () => {
    const s = lobby();
    join(s, 'p1');
    expect(submitAnswer(s, 'p1', 'a1', 0)).toEqual({ ok: false, code: 'not_answering' });
    const a = answering();
    expect(submitAnswer(a, 'inconnu', 'a1', 10_100)).toEqual({ ok: false, code: 'unknown_player' });
    expect(submitAnswer(a, 'p1', 'zzz', 10_100)).toEqual({ ok: false, code: 'invalid_answer' });
    expect(submitAnswer(a, 'p1', 'a1', 10_000 + 30_000)).toEqual({ ok: false, code: 'too_late' });
  });
  it('clôt la question quand tous ont répondu, dans la même transition', () => {
    const s = answering();
    submitAnswer(s, 'p1', 'a1', 10_100);
    const last = submitAnswer(s, 'p2', 'a2', 10_200);
    expect(last).toMatchObject({ ok: true, result: { answerCount: 2 } });
    expect(s.status).toBe('review');
    if (last.ok) {
      expect(last.result.ended?.correctAnswerIds).toEqual(['a1']);
      expect(last.result.ended?.leaderboard[0].nickname).toBe('p1');
      expect(last.result.ended?.stats.answerCounts).toEqual({ a1: 1, a2: 1 });
    }
  });
});

describe('question suivante et fin de partie', () => {
  it('enchaîne puis termine après la dernière question', () => {
    const s = answering();
    endQuestion(s);
    expect(nextQuestion(s)).toMatchObject({ ok: true, result: { finished: false, question: { id: 'q2', index: 1, total: 2 } } });
    expect(s.answers).toEqual({});
    revealAnswers(s, 1);
    endQuestion(s);
    expect(nextQuestion(s)).toMatchObject({ ok: true, result: { finished: true } });
    expect(s.status).toBe('finished');
  });
  it('refuse next dans le salon ou pendant le décompte (la première question serait sautée)', () => {
    const s = lobby();
    join(s, 'p1');
    expect(nextQuestion(s)).toEqual({ ok: false, code: 'bad_phase' });
    startGame(s);
    expect(nextQuestion(s)).toEqual({ ok: false, code: 'bad_phase' });
  });
  it('peut être terminée tout de suite', () => {
    const s = answering();
    expect(endGame(s)).toMatchObject({ ok: true, result: { finished: true } });
    expect(endGame(s)).toEqual({ ok: false, code: 'bad_phase' });
  });
});

describe('vue publique : aucune fuite des bonnes réponses', () => {
  const serialized = (s: QuizState) => JSON.stringify(publicQuizState(s));

  it('ne contient ni isCorrect, ni jeton, ni empreinte, pendant les réponses', () => {
    const s = answering();
    const text = serialized(s);
    expect(text).not.toContain('isCorrect');
    expect(text).not.toContain('hash-p1');
    expect(text).not.toContain('tokenHash');
    expect(publicQuizState(s).correctAnswerIds).toBeNull();
    expect(publicQuizState(s).answers).toEqual([{ id: 'a1', text: 'Paris' }, { id: 'a2', text: 'Lyon' }]);
  });
  it('n’expose les bonnes réponses qu’une fois la question close', () => {
    const s = answering();
    endQuestion(s);
    const view = publicQuizState(s);
    expect(view.correctAnswerIds).toEqual(['a1']);
    expect(view.leaderboard).not.toBeNull();
    expect(view.stats).not.toBeNull();
    expect(serialized(s)).not.toContain('tokenHash');
  });
  it('ne montre aucune question avant le départ', () => {
    const s = lobby();
    join(s, 'p1');
    expect(publicQuizState(s).question).toBeNull();
    expect(publicQuizState(s).correctAnswerIds).toBeNull();
  });
  it('donne les scores finaux en fin de partie, et rien avant', () => {
    const s = answering();
    expect(publicQuizState(s).finalScores).toBeNull();
    endGame(s);
    expect(publicQuizState(s).finalScores).toHaveLength(2);
  });
  it('n’annonce que le nombre de réponses pendant la question', () => {
    const s = answering();
    submitAnswer(s, 'p1', 'a1', 10_100);
    const view = publicQuizState(s);
    expect(view.answerCount).toBe(1);
    expect(JSON.stringify(view)).not.toContain('responseTime');
  });
});
