import { call, type ApiResult } from './client-http';

/**
 * Appels réseau du Quiz côté navigateur : un seul endroit, des types explicites.
 * Contrat : routes `/api/jeux/**` (chantier J1), mêmes formes que l'application d'origine.
 * Aucune logique serveur ici.
 */

// ── Types métier ─────────────────────────────────────────────────────────────
export type QuestionType = 'multiple_choice' | 'true_false' | 'multiple_select';

export type QuizAnswer = { id: string; questionId?: string; text: string; isCorrect: boolean };

export type QuizQuestion = {
  id: string;
  quizId?: string;
  text: string;
  type: QuestionType;
  /** Durée de réponse en secondes. */
  timeLimit: number;
  order: number;
  imageUrl?: string;
  answers: QuizAnswer[];
};

export type Quiz = {
  id: string;
  adminId?: string;
  title: string;
  description: string;
  themeColor: string;
  createdAt: string;
  updatedAt: string;
};

export type QuizSummary = Quiz & { questionCount: number };

export type SessionStatus = 'waiting' | 'active' | 'finished';

export type QuizSession = {
  id: string;
  quizId: string;
  code: string;
  status: SessionStatus;
  maxPlayers: number;
  createdAt: string;
  finishedAt?: string;
};

export type SessionWithQuiz = QuizSession & { quiz?: Pick<Quiz, 'id' | 'title'> | null };

/** Joueur d'une partie : le score n'est lisible que par l'animateur (lecture publique : pseudo seulement). */
export type SessionPlayer = { id: string; nickname: string; score?: number };

export type GameStatus = 'lobby' | 'starting' | 'question_show' | 'answering' | 'review' | 'finished';

export type LobbyPlayer = { id: string; nickname: string };

export type LeaderboardEntry = { rank: number; id: string; nickname: string; score: number };

/** Question telle que diffusée aux joueurs : jamais les bonnes réponses. */
export type PublicQuestion = {
  id: string;
  text: string;
  type: QuestionType;
  timeLimit: number;
  imageUrl?: string | null;
  index: number;
  total: number;
};

export type PublicAnswer = { id: string; text: string };

export type QuestionStats = { answerCounts: Record<string, number>; totalAnswered: number };

// ── Réponses des routes (contrat : docs/jeux.md) ─────────────────────────────
export type GameStateResponse = {
  status: GameStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  players: LobbyPlayer[];
  question: PublicQuestion | null;
  /** Renseigné uniquement pendant la phase `answering`, sans les bonnes réponses. */
  answers: PublicAnswer[] | null;
  /** Horodatage serveur (ms) de l'ouverture des réponses. */
  questionStartTime: number | null;
  /** Réponses reçues (pendant `answering`). */
  answerCount: number | null;
  /** Seulement en `review`. */
  correctAnswerIds: string[] | null;
  /** En `review` et `finished`. */
  leaderboard: LeaderboardEntry[] | null;
  stats: QuestionStats | null;
  finalScores: LeaderboardEntry[] | null;
};

export type SessionDetailResponse = {
  session: QuizSession;
  quiz: { id: string; title: string; themeColor?: string } | null;
  players: SessionPlayer[];
  liveState: { status: GameStatus; playerCount: number; currentQuestionIndex: number; totalQuestions: number } | null;
};

export type AnswerResponse = { ok: true; isCorrect: boolean; points: number; totalScore: number };

/** Réponse de `POST /api/jeux/sessions/join` (identité du joueur = compte connecté ; aucun jeton). */
export type JoinQuizResponse = { sessionId: string; playerId: string; nickname: string; sessionCode: string; trial: boolean };

// ── Événements temps réel (canal `session-<id>`) ─────────────────────────────
export type QuizEventMap = {
  'lobby:updated': { players: LobbyPlayer[] };
  'game:starting': { countdown: number };
  'question:show': PublicQuestion;
  /** `remainingTime` (secondes) est facultatif : absent, on part de `timeLimit`. */
  'question:answers': { answers: PublicAnswer[]; remainingTime?: number };
  'answer:received': { count: number; total: number };
  'question:ended': { correctAnswerIds: string[]; leaderboard: LeaderboardEntry[]; stats: QuestionStats };
  'game:ended': { finalScores: LeaderboardEntry[] };
};
/** Résultat individuel, diffusé sur l'événement `answer:result:<playerId>`. */
export type AnswerResultEvent = { isCorrect: boolean; points: number; totalScore: number };

// ── Appel générique : voir client-http.ts ────────────────────────────────────
export type { ApiResult };

const base = '/api/jeux';
const enc = encodeURIComponent;

// ── Bibliothèque et éditeur (formateur / administrateur) ─────────────────────
export const listQuizzes = () => call<{ quizzes: QuizSummary[] }>(`${base}/quizzes`);

export const createQuiz = (input: { title: string; description?: string; themeColor?: string }) =>
  call<{ quiz: Quiz }>(`${base}/quizzes`, { method: 'POST', body: input });

export const getQuiz = (id: string) => call<{ quiz: Quiz; questions: QuizQuestion[] }>(`${base}/quizzes/${enc(id)}`);

export const saveQuiz = (
  id: string,
  input: { quiz?: { title: string; description: string; themeColor: string }; questions?: QuizQuestion[] },
) => call<{ quiz: Quiz; questions: QuizQuestion[] }>(`${base}/quizzes/${enc(id)}`, { method: 'PUT', body: input });

export const deleteQuiz = (id: string) => call<{ ok: true }>(`${base}/quizzes/${enc(id)}`, { method: 'DELETE' });

// ── Parties ──────────────────────────────────────────────────────────────────
export const listSessions = () => call<{ sessions: SessionWithQuiz[] }>(`${base}/sessions`);

export const createSession = (quizId: string, maxPlayers = 10) =>
  call<{ session: QuizSession }>(`${base}/sessions`, { method: 'POST', body: { quizId, maxPlayers } });

/** Public : code, titre du quiz, joueurs et classement d'une partie. */
export const getSession = (id: string) => call<SessionDetailResponse>(`${base}/sessions/${enc(id)}`);

export const cancelSession = (id: string) => call<{ ok: true }>(`${base}/sessions/${enc(id)}`, { method: 'DELETE' });

// ── Déroulé d'une partie ─────────────────────────────────────────────────────
const game = (sessionId: string, path: string) => `${base}/quiz/${enc(sessionId)}/${path}`;

export const getGameState = (sessionId: string) => call<GameStateResponse>(game(sessionId, 'state'));

/** Animateur. */
export const startGame = (sessionId: string) => call<{ ok: true }>(game(sessionId, 'start'), { method: 'POST' });
export const showQuestion = (sessionId: string, index: number) =>
  call<{ ok: true }>(game(sessionId, 'show-question'), { method: 'POST', body: { index } });
export const revealAnswers = (sessionId: string) => call<{ ok: true }>(game(sessionId, 'reveal-answers'), { method: 'POST' });
export const endQuestion = (sessionId: string) => call<{ ok: true }>(game(sessionId, 'end-question'), { method: 'POST' });
export const nextQuestion = (sessionId: string) =>
  call<{ ok: true; finished: boolean }>(game(sessionId, 'next'), { method: 'POST' });

/** Rejoindre avec un code et un pseudo (compte participant connecté ; `trial` : partie d'essai d'un animateur). */
export const joinQuiz = (code: string, nickname: string, trial = false) =>
  call<JoinQuizResponse>(`${base}/sessions/join`, { method: 'POST', body: trial ? { code, nickname, trial: true } : { code, nickname } });

/** Joueur connecté : confirme sa place dans la salle (idempotent). L'identité vient des cookies. */
export const joinGame = (sessionId: string, playerId: string) => call<{ ok: true }>(game(sessionId, 'join'), { method: 'POST', body: { playerId } });
export const submitAnswer = (sessionId: string, playerId: string, answerId: string) =>
  call<AnswerResponse>(game(sessionId, 'answer'), { method: 'POST', body: { playerId, answerId } });
