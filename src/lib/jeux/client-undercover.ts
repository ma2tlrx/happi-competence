import { call, type ApiResult } from './client-http';
import { NICKNAME_MAX, NICKNAME_MIN, nicknameError } from './nickname';

export type { ApiResult };
export { NICKNAME_MAX, NICKNAME_MIN, nicknameError };

/**
 * Appels réseau du navigateur vers le moteur des jeux (contrat `/api/jeux/**`) pour Undercover
 * (« Fourmi Caché ») et pour l'accès aux parties (page /jouer, hub /jeux).
 *
 * Aucune logique serveur ici. L'identité vient de la session HAPPI (cookies) : aucun jeton de joueur
 * ni d'animateur n'est envoyé ni conservé sur l'appareil.
 */

// ── Types publics d'une partie (ce que le serveur peut montrer à tout le monde) ──────────────────

export type UndercoverRole = 'civil' | 'undercover' | 'spy';
export type UndercoverStatus = 'lobby' | 'role_reveal' | 'discussion' | 'voting' | 'vote_result' | 'spy_guess' | 'game_over';
export type UndercoverWinner = 'civils' | 'undercover' | 'spy';

export type PublicPlayer = {
  id: string;
  nickname: string;
  isHost: boolean;
  isEliminated: boolean;
  eliminatedInRound?: number;
  joinedAt: number;
  /** Fourni par le serveur uniquement en fin de partie (jamais avant). */
  role?: UndercoverRole;
};

export type RoundResult = {
  roundNumber: number;
  votes: Record<string, string>;
  eliminatedId: string | null;
  eliminatedNickname: string | null;
  eliminatedRole: UndercoverRole | null;
  wasTie: boolean;
};

export type WordPair = { civil: string; undercover: string };

export type PublicGame = {
  gameId: string;
  code: string;
  status: UndercoverStatus;
  hostId: string;
  players: Record<string, PublicPlayer>;
  playerCount: number;
  voteCount: number;
  includeMisterWhite: boolean;
  maxPlayers: number;
  currentRound: number;
  roundResults: RoundResult[];
  speakingOrder: string[];
  currentSpeakerIndex: number;
  tiebreakPlayerIds?: string[];
  winner?: UndercoverWinner;
  winnerIds?: string[];
  spyGuess?: string;
  spyGuessCorrect?: boolean;
  /** Mots révélés seulement en fin de partie. */
  wordPair?: WordPair;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
};

/** Réponse de `POST …/join` d'une partie Undercover. */
export type JoinUndercoverResponse = { playerId: string; nickname: string; trial: boolean };

export type UndercoverConfig = {
  id: string;
  name: string;
  civilWord: string;
  undercoverWord: string;
  includeMisterWhite: boolean;
  createdAt: number;
};

/** Résumé d'une partie de quiz, tel que renvoyé par `GET /api/jeux/sessions`. */
export type QuizSessionSummary = {
  id: string;
  quizId: string;
  code: string;
  status: 'waiting' | 'active' | 'finished';
  maxPlayers: number;
  createdAt: string;
  finishedAt?: string;
  quiz?: { id: string; title: string } | null;
};

const base = '/api/jeux/undercover';
const gameUrl = (gameId: string) => `${base}/games/${encodeURIComponent(gameId)}`;

export const undercoverApi = {
  /** GET /api/jeux/undercover/games?code=ABC123 → { game } (404 si aucune partie Undercover, 409 si déjà commencée). */
  lookup: (code: string) => call<{ game: PublicGame }>(`${base}/games?code=${encodeURIComponent(code)}`),

  /** POST /api/jeux/undercover/games → { gameId, code, … } (animateur connecté uniquement). */
  create: (body: { nickname?: string; civilWord: string; undercoverWord: string; includeMisterWhite: boolean }) =>
    call<{ gameId: string; code: string; isHost: true }>(`${base}/games`, { method: 'POST', body }),

  /** GET /api/jeux/undercover/games/[id] → { game } (sans mots ni rôles avant la fin). */
  get: (gameId: string) => call<{ game: PublicGame }>(gameUrl(gameId)),

  /** POST …/join { nickname, trial? } → { playerId, nickname, trial } (participant connecté, ou animateur en essai). */
  join: (gameId: string, nickname: string, trial = false) =>
    call<JoinUndercoverResponse>(`${gameUrl(gameId)}/join`, { method: 'POST', body: trial ? { nickname, trial: true } : { nickname } }),

  /** Actions de l'animateur : son compte et la propriété de la partie suffisent, aucun jeton. */
  start: (gameId: string) => call<{ game: PublicGame }>(`${gameUrl(gameId)}/start`, { method: 'POST' }),

  /** Partie encore au salon d'attente. */
  cancel: (gameId: string) => call<{ ok: true }>(`${gameUrl(gameId)}/cancel`, { method: 'POST' }),

  nextPhase: (gameId: string, action: 'start_discussion' | 'next_speaker' | 'start_voting') =>
    call<{ game: PublicGame }>(`${gameUrl(gameId)}/next-phase`, { method: 'POST', body: { action } }),

  /** En cas d'égalité : nouveau vote entre les ex æquo, `tiebreakPlayerIds` renseigné. */
  resolveVote: (gameId: string) => call<{ game: PublicGame }>(`${gameUrl(gameId)}/resolve-vote`, { method: 'POST' }),

  /** Retour au salon d'attente, rôles effacés. */
  replay: (gameId: string) => call<{ game: PublicGame }>(`${gameUrl(gameId)}/replay`, { method: 'POST' }),

  /** POST …/vote { voterId, targetId } → { allVoted, game }. */
  vote: (gameId: string, body: { voterId: string; targetId: string }) =>
    call<{ allVoted: boolean; game: PublicGame }>(`${gameUrl(gameId)}/vote`, { method: 'POST', body }),

  /** POST …/my-role { playerId } → { role, word } : le rôle d'un joueur, jamais celui d'un autre. */
  myRole: (gameId: string, body: { playerId: string }) =>
    call<{ role: UndercoverRole; word: string | null }>(`${gameUrl(gameId)}/my-role`, { method: 'POST', body }),

  /** POST …/spy-guess { spyId, guess } → { game }. */
  spyGuess: (gameId: string, body: { spyId: string; guess: string }) =>
    call<{ game: PublicGame }>(`${gameUrl(gameId)}/spy-guess`, { method: 'POST', body }),

  /** GET /api/jeux/undercover/configs → { configs } (propriétaire connecté). */
  listConfigs: () => call<{ configs: UndercoverConfig[] }>(`${base}/configs`),

  /** POST /api/jeux/undercover/configs { name, civilWord, undercoverWord, includeMisterWhite } → 201 { config }. */
  saveConfig: (body: { name: string; civilWord: string; undercoverWord: string; includeMisterWhite: boolean }) =>
    call<{ config: UndercoverConfig }>(`${base}/configs`, { method: 'POST', body }),

  /** DELETE /api/jeux/undercover/configs/[id] → { ok: true }. */
  deleteConfig: (id: string) => call<{ ok: true }>(`${base}/configs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const quizAccessApi = {
  /** GET /api/jeux/sessions → { sessions } (parties de quiz de l'animateur, avec leur quiz). */
  recentSessions: () => call<{ sessions: QuizSessionSummary[] }>('/api/jeux/sessions'),
};

// ── Règles de saisie communes ────────────────────────────────────────────────────────────────────

export const CODE_LENGTH = 6;

export function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}
