import { describe, expect, it } from 'vitest';

import { joinLobby, newQuizState, revealAnswers, showQuestion, startGame, submitAnswer, endGame, type QuizQuestion, type QuizState } from './quiz-engine';
import { quizResultRows, summarizeResults, undercoverResultRows, undercoverTitle, type GameResultRow } from './results';
import { joinGame, newUndercoverGame, replayGame, resolveVotes, startGame as startUndercover, startVoting, nextRound, submitVote, type UndercoverState } from './undercover-engine';

const questions: QuizQuestion[] = [
  { id: 'q1', text: 'Q1', type: 'multiple_choice', timeLimit: 20, answers: [{ id: 'a1', text: 'Oui', isCorrect: true }, { id: 'a2', text: 'Non', isCorrect: false }] },
  { id: 'q2', text: 'Q2', type: 'multiple_choice', timeLimit: 20, answers: [{ id: 'b1', text: 'Oui', isCorrect: true }, { id: 'b2', text: 'Non', isCorrect: false }] },
];

function playedQuiz(): QuizState {
  const s = newQuizState('sess-1', questions, 10);
  joinLobby(s, { id: 'p1', nickname: 'Ana', userId: 'u1', participantId: 'part1' });
  joinLobby(s, { id: 'p2', nickname: 'Ben', userId: 'u2', participantId: 'part2' });
  joinLobby(s, { id: 'p3', nickname: 'Animateur', userId: 'u3', participantId: null, trial: true });
  startGame(s);
  showQuestion(s, 0);
  revealAnswers(s, 10_000);
  submitAnswer(s, 'p3', 'a1', 10_100); // l'animateur en essai répond le plus vite et le mieux
  submitAnswer(s, 'p1', 'a1', 12_000);
  submitAnswer(s, 'p2', 'a2', 11_000);
  showQuestion(s, 1);
  revealAnswers(s, 20_000);
  submitAnswer(s, 'p1', 'b1', 21_000);
  submitAnswer(s, 'p2', 'b1', 24_000);
  submitAnswer(s, 'p3', 'b1', 20_100);
  endGame(s);
  return s;
}

describe('résultats du Quiz', () => {
  it('une ligne par participant, jamais pour un animateur en mode essai', () => {
    const rows = quizResultRows(playedQuiz(), { sessionId: 'sess-1', title: 'Mon quiz' });
    expect(rows.map((r) => r.participant_id).sort()).toEqual(['part1', 'part2']);
  });
  it('rang et nombre de joueurs sans les joueurs en essai ; statistiques cumulées', () => {
    const rows = quizResultRows(playedQuiz(), { sessionId: 'sess-1', title: 'Mon quiz' });
    const ana = rows.find((r) => r.participant_id === 'part1')!;
    const ben = rows.find((r) => r.participant_id === 'part2')!;
    expect(ana).toMatchObject({ game_type: 'quiz', game_ref: 'sess-1', play_index: 1, player_count: 2, rank: 1, question_count: 2, answered_count: 2, correct_answers: 2, title: 'Mon quiz' });
    expect(ben).toMatchObject({ rank: 2, answered_count: 2, correct_answers: 1 });
    expect(ana.avg_response_ms).toBe(Math.round((2000 + 1000) / 2));
    expect(ana.score).toBeGreaterThan(ben.score!);
    expect(ana.role).toBeNull();
  });
  it('ne contient ni pseudo ni identifiant de compte', () => {
    const text = JSON.stringify(quizResultRows(playedQuiz(), { sessionId: 'sess-1', title: 'Mon quiz' }));
    for (const forbidden of ['Ana', 'Ben', 'Animateur', 'u1', 'u2', 'nickname', 'userId']) expect(text).not.toContain(forbidden);
  });
  it('ne produit rien quand personne n’est participant', () => {
    const s = newQuizState('s', questions, 10);
    joinLobby(s, { id: 'p', nickname: 'Essai', userId: 'u', participantId: null, trial: true });
    expect(quizResultRows(s, { sessionId: 's' })).toEqual([]);
  });
});

function playedUndercover(): UndercoverState {
  const now = 1_000;
  const s = newUndercoverGame({ gameId: 'g1', code: 'ABC234', hostId: 'host', hostNickname: 'Animateur', customWordPair: { civil: 'MOT-CIVIL', undercover: 'MOT-AUTRE' }, includeMisterWhite: false, now });
  joinGame(s, { id: 'j1', nickname: 'Un', userId: 'u1', participantId: 'part1', now });
  joinGame(s, { id: 'j2', nickname: 'Deux', userId: 'u2', participantId: 'part2', now });
  joinGame(s, { id: 'j3', nickname: 'Trois', userId: 'u3', participantId: 'part3', now });
  startUndercover(s, 2_000, () => 0.3);
  return s;
}

/** Fait voter tout le monde contre l'undercover : les civils gagnent. */
function civilsWin(s: UndercoverState) {
  nextRound(s);
  startVoting(s);
  const undercover = Object.values(s.players).find((p) => p.role === 'undercover')!;
  for (const p of Object.values(s.players).filter((p) => !p.isHost && p.id !== undercover.id)) submitVote(s, p.id, undercover.id, p.userId!);
  submitVote(s, undercover.id, Object.values(s.players).find((p) => p.role === 'civil')!.id, undercover.userId!);
  resolveVotes(s, 9_000);
}

describe('résultats d’Undercover', () => {
  it('rien tant que la partie n’est pas terminée', () => {
    expect(undercoverResultRows(playedUndercover())).toEqual([]);
  });
  it('une ligne par participant (ni animateur ni essai), issue selon le rôle, sans mots ni pseudo', () => {
    const s = playedUndercover();
    civilsWin(s);
    expect(s.status).toBe('game_over');
    expect(s.winner).toBe('civils');
    const rows = undercoverResultRows(s);
    expect(rows.map((r) => r.participant_id).sort().every((id) => ['part1', 'part2', 'part3'].includes(id))).toBe(true);
    expect(rows.length).toBe(Object.values(s.players).filter((p) => !p.isHost && !p.trial && p.participantId).length);
    for (const row of rows) {
      expect(row).toMatchObject({ game_type: 'undercover', game_ref: 'g1', play_index: 1, player_count: rows.length, rank: null, score: null });
      expect(row.outcome).toBe(row.role === 'civil' ? 'won' : 'lost');
    }
    const eliminated = rows.find((r) => r.role === 'undercover');
    expect(eliminated?.rounds_survived).toBe(0);
    const survivor = rows.find((r) => r.role === 'civil');
    expect(survivor?.rounds_survived).toBe(1);
    const text = JSON.stringify(rows);
    for (const forbidden of ['MOT-CIVIL', 'MOT-AUTRE', 'Un', 'Deux', 'Animateur', 'nickname', 'userId']) expect(text).not.toContain(`"${forbidden}"`);
    expect(text).not.toContain('MOT-');
    expect(rows[0].title).toBe('Mots personnalisés');
  });
  it('un joueur en mode essai n’a jamais de ligne', () => {
    const s = playedUndercover();
    s.players.j1.trial = true;
    s.players.j1.participantId = null;
    civilsWin(s);
    const rows = undercoverResultRows(s);
    expect(rows.map((r) => r.participant_id)).not.toContain('part1');
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.player_count === 2)).toBe(true);
  });
  it('rejouer incrémente la manche : une nouvelle série de lignes, jamais un doublon', () => {
    const s = playedUndercover();
    civilsWin(s);
    const first = undercoverResultRows(s);
    replayGame(s);
    expect(s.playNumber).toBe(2);
    startUndercover(s, 20_000, () => 0.6);
    civilsWin(s);
    const second = undercoverResultRows(s);
    expect(new Set(first.map((r) => r.play_index))).toEqual(new Set([1]));
    expect(new Set(second.map((r) => r.play_index))).toEqual(new Set([2]));
  });
  it('titre : thème choisi ou mots personnalisés, jamais les mots', () => {
    expect(undercoverTitle({ themeId: 'standard' })).toBe('Thème : Standard');
    expect(undercoverTitle({ customWordPair: { civil: 'a', undercover: 'b' } })).toBe('Mots personnalisés');
  });
});

describe('indicateurs', () => {
  const base = { id: 'x', player_count: 5, question_count: 10, role: null, outcome: null, rounds_survived: null, title: null };
  const rows: GameResultRow[] = [
    { ...base, id: '1', game_type: 'quiz', played_at: '2026-11-01T10:00:00Z', rank: 1, score: 8000, answered_count: 10, correct_answers: 8, avg_response_ms: 4000 },
    { ...base, id: '2', game_type: 'quiz', played_at: '2026-11-03T10:00:00Z', rank: 4, score: 3000, answered_count: 10, correct_answers: 2, avg_response_ms: 8000 },
    { ...base, id: '3', game_type: 'undercover', played_at: '2026-11-02T10:00:00Z', rank: null, score: null, answered_count: null, correct_answers: null, avg_response_ms: null, role: 'civil', outcome: 'won', rounds_survived: 2 },
    { ...base, id: '4', game_type: 'undercover', played_at: '2026-11-04T10:00:00Z', rank: null, score: null, answered_count: null, correct_answers: null, avg_response_ms: null, role: 'spy', outcome: 'lost', rounds_survived: 0 },
  ];
  it('synthétise quiz et undercover', () => {
    const s = summarizeResults(rows);
    expect(s.total).toBe(4);
    expect(s.quiz).toEqual({ games: 2, bestScore: 8000, firstPlaces: 1, podiums: 1, accuracy: 50, avgResponseMs: 6000 });
    expect(s.undercover.games).toBe(2);
    expect(s.undercover.winRate).toBe(50);
    expect(s.undercover.byRole.civil).toEqual({ games: 1, wins: 1 });
    expect(s.undercover.byRole.spy).toEqual({ games: 1, wins: 0 });
    expect(s.lastPlayedAt).toBe('2026-11-04T10:00:00Z');
  });
  it('est vide sans résultat', () => {
    const s = summarizeResults([]);
    expect(s.total).toBe(0);
    expect(s.quiz.accuracy).toBeNull();
    expect(s.undercover.winRate).toBeNull();
    expect(s.lastPlayedAt).toBeNull();
  });
});
