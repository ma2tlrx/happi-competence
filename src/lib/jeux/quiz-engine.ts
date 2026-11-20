/**
 * Quiz en direct : transitions de l'état d'une partie. Logique pure (aucun accès réseau ni base) :
 * chaque fonction modifie l'état reçu et renvoie un résultat ou un motif de refus. Les routes
 * l'appellent à l'intérieur de `mutateState` (verrou optimiste), ce qui la rend rejouable.
 *
 * Phases : lobby → starting → question_show → answering → review → (question_show …) → finished.
 */
import {
  calculatePoints,
  getLeaderboard,
  getQuestionStats,
  isWithinTime,
  type GameAnswer,
  type GamePlayer,
  type LeaderboardEntry,
} from './scoring';
import { fail, ok } from './result';

export type QuizAnswer = { id: string; text: string; isCorrect: boolean };

export type QuizQuestion = {
  id: string;
  text: string;
  type: 'multiple_choice' | 'true_false' | 'multiple_select';
  timeLimit: number;
  imageUrl?: string | null;
  answers: QuizAnswer[];
};

export type QuizStatus = 'lobby' | 'starting' | 'question_show' | 'answering' | 'review' | 'finished';

export type QuizState = {
  sessionId: string;
  status: QuizStatus;
  currentQuestionIndex: number;
  questionStartTime: number | null;
  players: Record<string, GamePlayer>;
  /** Réponses à la question en cours, par joueur. */
  answers: Record<string, GameAnswer>;
  questions: QuizQuestion[];
  maxPlayers: number;
};

export function newQuizState(sessionId: string, questions: QuizQuestion[], maxPlayers: number): QuizState {
  return {
    sessionId,
    status: 'lobby',
    currentQuestionIndex: 0,
    questionStartTime: null,
    players: {},
    answers: {},
    questions,
    maxPlayers,
  };
}

/** Un joueur entre dans la salle (ou y revient avec le même compte : l'opération est idempotente). */
export function joinLobby(
  state: QuizState,
  player: { id: string; nickname: string; userId: string; participantId?: string | null; trial?: boolean },
) {
  const existing = state.players[player.id];
  if (existing) {
    return existing.userId === player.userId ? ok({ rejoined: true }) : fail('forbidden');
  }
  if (state.status !== 'lobby') return fail('already_started');
  if (Object.keys(state.players).length >= state.maxPlayers) return fail('full');
  const taken = Object.values(state.players).some((p) => p.nickname.toLowerCase() === player.nickname.toLowerCase());
  if (taken) return fail('nickname_taken');
  state.players[player.id] = {
    id: player.id,
    nickname: player.nickname,
    score: 0,
    userId: player.userId,
    participantId: player.participantId ?? null,
    trial: player.trial === true,
    answeredCount: 0,
    correctCount: 0,
    totalResponseMs: 0,
  };
  return ok({ rejoined: false });
}

/** L'identifiant de joueur désigne-t-il bien le compte connecté ? (Seule garantie d'identité : plus aucun jeton.) */
export function isPlayerOf(state: QuizState, playerId: string, userId: string): boolean {
  const player = state.players[playerId];
  return !!player?.userId && player.userId === userId;
}

/** Joueur de cette partie correspondant au compte (reprise après déconnexion). */
export function findPlayerByUser(state: QuizState, userId: string) {
  return Object.values(state.players).find((p) => p.userId === userId);
}

export function startGame(state: QuizState) {
  if (state.status !== 'lobby') return fail('bad_phase');
  if (Object.keys(state.players).length === 0) return fail('no_players');
  state.status = 'starting';
  return ok({ countdown: 3 });
}

/** Affiche la question `index` (sans ses réponses) : depuis le décompte, la correction ou une question déjà affichée. */
export function showQuestion(state: QuizState, index: number) {
  if (state.status === 'lobby' || state.status === 'finished') return fail('bad_phase');
  const question = state.questions[index];
  if (!question) return fail('not_found');
  state.status = 'question_show';
  state.currentQuestionIndex = index;
  state.answers = {};
  state.questionStartTime = null;
  return ok({ question: publicQuestion(question, index, state.questions.length) });
}

/**
 * Affiche les réponses et lance le chronomètre. Refusée si les réponses sont déjà affichées :
 * un double clic ne doit pas remettre le chronomètre à zéro.
 */
export function revealAnswers(state: QuizState, now: number) {
  if (state.status !== 'question_show') return fail('bad_phase');
  const question = state.questions[state.currentQuestionIndex];
  if (!question) return fail('not_found');
  state.status = 'answering';
  state.questionStartTime = now;
  return ok({ answers: question.answers.map((a) => ({ id: a.id, text: a.text })), remainingTime: question.timeLimit });
}

export type QuestionEnd = {
  correctAnswerIds: string[];
  leaderboard: LeaderboardEntry[];
  stats: ReturnType<typeof getQuestionStats>;
};

function closeQuestion(state: QuizState): QuestionEnd {
  const question = state.questions[state.currentQuestionIndex];
  state.status = 'review';
  return {
    correctAnswerIds: question.answers.filter((a) => a.isCorrect).map((a) => a.id),
    leaderboard: getLeaderboard(state.players),
    stats: getQuestionStats(state.answers, question.answers.map((a) => a.id)),
  };
}

/** L'animateur clôt la question avant la fin du temps. */
export function endQuestion(state: QuizState) {
  if (state.status !== 'answering') return fail('bad_phase');
  return ok(closeQuestion(state));
}

export type AnswerOutcome = {
  isCorrect: boolean;
  points: number;
  totalScore: number;
  answerCount: number;
  playerCount: number;
  /** Tous les joueurs ont répondu : la question vient d'être clôturée par cet appel. */
  ended: QuestionEnd | null;
};

/**
 * Enregistre la réponse d'un joueur. Le compte est vérifié par l'appelant (isPlayerOf) ; ici on
 * contrôle la phase, le doublon, la validité de la réponse et le temps. Quand le dernier joueur
 * répond, la question est clôturée dans la même écriture : pas de fenêtre entre les deux.
 */
export function submitAnswer(state: QuizState, playerId: string, answerId: string, now: number) {
  if (state.status !== 'answering') return fail('not_answering');
  const player = state.players[playerId];
  if (!player) return fail('unknown_player');
  if (state.answers[playerId]) return fail('already_answered');
  const question = state.questions[state.currentQuestionIndex];
  const answer = question.answers.find((a) => a.id === answerId);
  if (!answer) return fail('invalid_answer');

  const responseTime = Math.max(0, now - (state.questionStartTime ?? now));
  if (!isWithinTime(responseTime, question.timeLimit)) return fail('too_late');

  const isCorrect = answer.isCorrect;
  const points = calculatePoints(responseTime, question.timeLimit, isCorrect);
  state.answers[playerId] = { answerId, responseTime, isCorrect, points };
  player.score += points;
  player.answeredCount = (player.answeredCount ?? 0) + 1;
  player.correctCount = (player.correctCount ?? 0) + (isCorrect ? 1 : 0);
  player.totalResponseMs = (player.totalResponseMs ?? 0) + responseTime;

  const answerCount = Object.keys(state.answers).length;
  const playerCount = Object.keys(state.players).length;
  const ended = answerCount >= playerCount ? closeQuestion(state) : null;
  return ok<AnswerOutcome>({ isCorrect, points, totalScore: player.score, answerCount, playerCount, ended });
}

export type NextOutcome =
  | { finished: true; finalScores: LeaderboardEntry[] }
  | { finished: false; question: ReturnType<typeof publicQuestion> };

/** Question suivante, ou fin de la partie après la dernière. */
export function nextQuestion(state: QuizState) {
  if (state.status === 'lobby' || state.status === 'starting' || state.status === 'finished') return fail('bad_phase');
  const nextIndex = state.currentQuestionIndex + 1;
  if (nextIndex >= state.questions.length) return ok<NextOutcome>(finish(state));
  state.status = 'question_show';
  state.currentQuestionIndex = nextIndex;
  state.answers = {};
  state.questionStartTime = null;
  return ok<NextOutcome>({ finished: false, question: publicQuestion(state.questions[nextIndex], nextIndex, state.questions.length) });
}

/** Terminer la partie maintenant, quelle que soit la question en cours. */
export function endGame(state: QuizState) {
  if (state.status === 'lobby' || state.status === 'finished') return fail('bad_phase');
  return ok<NextOutcome>(finish(state));
}

function finish(state: QuizState): NextOutcome {
  state.status = 'finished';
  return { finished: true, finalScores: getLeaderboard(state.players) };
}

/** Question telle que les joueurs la voient : jamais les réponses, jamais les bonnes. */
export function publicQuestion(question: QuizQuestion, index: number, total: number) {
  return {
    id: question.id,
    text: question.text,
    type: question.type,
    timeLimit: question.timeLimit,
    imageUrl: question.imageUrl || null,
    index,
    total,
  };
}

/**
 * Vue publique de l'état (GET /state) : pseudos et identifiants de salle, question en cours,
 * réponses SANS la mention « correcte » tant que la question n'est pas close. Les bonnes
 * réponses et le classement n'apparaissent qu'en correction (review) et à la fin.
 */
export function publicQuizState(state: QuizState) {
  const question = state.questions[state.currentQuestionIndex];
  const revealed = state.status === 'review' || state.status === 'finished';
  return {
    status: state.status,
    currentQuestionIndex: state.currentQuestionIndex,
    totalQuestions: state.questions.length,
    players: Object.values(state.players).map((p) => ({ id: p.id, nickname: p.nickname })),
    question: question && state.status !== 'lobby' && state.status !== 'starting'
      ? publicQuestion(question, state.currentQuestionIndex, state.questions.length)
      : null,
    answers: state.status === 'answering' ? (question?.answers.map((a) => ({ id: a.id, text: a.text })) ?? null) : null,
    questionStartTime: state.questionStartTime,
    // Ajouts pour la reconnexion d'un joueur : rien avant la clôture de la question.
    correctAnswerIds: state.status === 'review' && question ? question.answers.filter((a) => a.isCorrect).map((a) => a.id) : null,
    leaderboard: revealed ? getLeaderboard(state.players) : null,
    // Statistiques de la question close et scores finaux : repli sans Realtime (mêmes données que question:ended / game:ended).
    stats: state.status === 'review' && question ? getQuestionStats(state.answers, question.answers.map((a) => a.id)) : null,
    // Nombre de réponses reçues (jamais lesquelles) pendant la question.
    answerCount: state.status === 'answering' ? Object.keys(state.answers).length : null,
    finalScores: state.status === 'finished' ? getLeaderboard(state.players) : null,
  };
}
