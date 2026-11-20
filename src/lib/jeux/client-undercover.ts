/**
 * Appels réseau du navigateur vers le moteur des jeux (contrat `/api/jeux/**`) pour Undercover
 * (« Fourmi Caché ») et pour l'accès aux parties (page /jouer, hub /jeux).
 *
 * Aucune logique serveur ici : ce module décrit seulement les formes de requêtes et de réponses
 * attendues, et conserve sur l'appareil l'identité d'un joueur ou de l'animateur (jeton de partie).
 * Les formes sont celles de l'application d'origine, sous le préfixe `/api/jeux`.
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

// ── Appels ───────────────────────────────────────────────────────────────────────────────────────

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const NETWORK_ERROR = 'Connexion impossible. Vérifiez votre réseau puis réessayez.';

function fallbackMessage(status: number) {
  if (status === 401 || status === 403) return 'Action non autorisée.';
  if (status === 404) return 'Partie introuvable. Elle a peut-être expiré.';
  if (status === 409) return 'Cette action n’est plus possible dans l’état actuel de la partie.';
  if (status === 410) return 'Cette partie est terminée.';
  if (status === 429) return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
  if (status >= 500) return 'Le service de jeu rencontre un problème. Réessayez dans un instant.';
  return 'La demande a échoué. Réessayez.';
}

async function call<T>(path: string, init?: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      // Le serveur renvoie `{ error }` en français ; on garde un message de repli pour tout autre cas.
      const message = typeof payload?.error === 'string' && payload.error ? payload.error : fallbackMessage(response.status);
      return { ok: false, status: response.status, error: message };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
}

const base = '/api/jeux/undercover';
const gameUrl = (gameId: string) => `${base}/games/${encodeURIComponent(gameId)}`;

export const undercoverApi = {
  /** GET /api/jeux/undercover/games?code=ABC123 → { game } (404 si aucune partie Undercover, 409 si déjà commencée). */
  lookup: (code: string) => call<{ game: PublicGame }>(`${base}/games?code=${encodeURIComponent(code)}`),

  /** POST /api/jeux/undercover/games → { gameId, code, playerId, playerToken, isHost } (animateur connecté uniquement). */
  create: (body: { nickname: string; civilWord: string; undercoverWord: string; includeMisterWhite: boolean }) =>
    call<{ gameId: string; code: string; playerId: string; playerToken: string; isHost: true }>(`${base}/games`, { method: 'POST', body }),

  /** GET /api/jeux/undercover/games/[id] → { game } (sans mots ni rôles avant la fin). */
  get: (gameId: string) => call<{ game: PublicGame }>(gameUrl(gameId)),

  /** POST …/join { nickname } → { playerId, playerToken, nickname }. */
  join: (gameId: string, nickname: string) =>
    call<{ playerId: string; playerToken: string; nickname: string }>(`${gameUrl(gameId)}/join`, { method: 'POST', body: { nickname } }),

  /** POST …/start { hostToken } → { game }. */
  start: (gameId: string, hostToken: string) => call<{ game: PublicGame }>(`${gameUrl(gameId)}/start`, { method: 'POST', body: { hostToken } }),

  /** POST …/cancel { hostToken } → { ok: true } (partie encore au salon d'attente). */
  cancel: (gameId: string, hostToken: string) => call<{ ok: true }>(`${gameUrl(gameId)}/cancel`, { method: 'POST', body: { hostToken } }),

  /** POST …/next-phase { hostToken, action } → { game }. */
  nextPhase: (gameId: string, hostToken: string, action: 'start_discussion' | 'next_speaker' | 'start_voting') =>
    call<{ game: PublicGame }>(`${gameUrl(gameId)}/next-phase`, { method: 'POST', body: { hostToken, action } }),

  /** POST …/resolve-vote { hostToken } → { game } (en cas d'égalité : nouveau vote entre les ex æquo, `tiebreakPlayerIds` renseigné). */
  resolveVote: (gameId: string, hostToken: string) =>
    call<{ game: PublicGame }>(`${gameUrl(gameId)}/resolve-vote`, { method: 'POST', body: { hostToken } }),

  /** POST …/replay { hostToken } → { game } (retour au salon d'attente, rôles effacés). */
  replay: (gameId: string, hostToken: string) => call<{ game: PublicGame }>(`${gameUrl(gameId)}/replay`, { method: 'POST', body: { hostToken } }),

  /** POST …/vote { voterId, targetId, playerToken } → { allVoted, game }. */
  vote: (gameId: string, body: { voterId: string; targetId: string; playerToken: string }) =>
    call<{ allVoted: boolean; game: PublicGame }>(`${gameUrl(gameId)}/vote`, { method: 'POST', body }),

  /** POST …/my-role { playerId, playerToken } → { role, word } : le rôle d'un joueur, jamais celui d'un autre. */
  myRole: (gameId: string, body: { playerId: string; playerToken: string }) =>
    call<{ role: UndercoverRole; word: string | null }>(`${gameUrl(gameId)}/my-role`, { method: 'POST', body }),

  /** POST …/spy-guess { spyId, playerToken, guess } → { game }. */
  spyGuess: (gameId: string, body: { spyId: string; playerToken: string; guess: string }) =>
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
  /**
   * POST /api/jeux/sessions/join { code, nickname } → { sessionId, playerId, nickname, sessionCode }.
   * 404 : code inconnu · 410 : partie terminée · 409 : déjà commencée, salle pleine ou pseudo pris · 429 : trop d'essais.
   */
  join: (code: string, nickname: string) =>
    call<{ sessionId: string; playerId: string; nickname: string; sessionCode: string }>('/api/jeux/sessions/join', {
      method: 'POST',
      body: { code, nickname },
    }),

  /** GET /api/jeux/sessions → { sessions } (parties de quiz de l'animateur, avec leur quiz). */
  recentSessions: () => call<{ sessions: QuizSessionSummary[] }>('/api/jeux/sessions'),
};

// ── Identité conservée sur l'appareil ────────────────────────────────────────────────────────────
// Un joueur ou l'animateur retrouve sa place après un rechargement. Seuls un identifiant, un jeton de
// partie (valable 24 h côté serveur) et le pseudo choisi sont conservés ; rien n'est envoyé à des tiers.

export type GameIdentity = { playerId: string; token: string; host: boolean };

const IDENTITY_EVENT = 'happi-jeux-identity';
const identityKey = (gameId: string) => `happi.jeux.undercover.${gameId}`;
const pendingKey = (gameId: string) => `happi.jeux.undercover.pseudo.${gameId}`;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible (navigation privée stricte) : la partie reste jouable tant que la page reste ouverte.
  }
  window.dispatchEvent(new Event(IDENTITY_EVENT));
}

/** Abonnement au stockage (même onglet et autres onglets), pour useSyncExternalStore. */
export function subscribeIdentity(callback: () => void) {
  window.addEventListener(IDENTITY_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(IDENTITY_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export function readIdentityRaw(gameId: string): string | null {
  return safeGet(identityKey(gameId));
}

export function parseIdentity(raw: string | null): GameIdentity | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<GameIdentity>;
    if (typeof value.playerId === 'string' && typeof value.token === 'string') {
      return { playerId: value.playerId, token: value.token, host: value.host === true };
    }
  } catch {
    // Valeur illisible : traitée comme absente.
  }
  return null;
}

export function saveIdentity(gameId: string, identity: GameIdentity) {
  safeSet(identityKey(gameId), JSON.stringify(identity));
}

export function clearIdentity(gameId: string) {
  safeSet(identityKey(gameId), null);
}

/** Pseudo saisi sur /jouer, utilisé une seule fois pour rejoindre la partie depuis son écran. */
export function savePendingNickname(gameId: string, nickname: string) {
  safeSet(pendingKey(gameId), nickname);
}

export function readPendingNickname(gameId: string): string | null {
  return safeGet(pendingKey(gameId));
}

export function clearPendingNickname(gameId: string) {
  safeSet(pendingKey(gameId), null);
}

/** Identité d'un joueur de quiz, au format attendu par l'écran de jeu du quiz (comme l'application d'origine). */
export function saveQuizIdentity(playerId: string, nickname: string) {
  try {
    window.localStorage.setItem('happi_player_id', playerId);
    window.localStorage.setItem('happi_nickname', nickname);
  } catch {
    // Les écrans du quiz reçoivent aussi l'identifiant dans l'adresse (?playerId=).
  }
}

// ── Règles de saisie communes ────────────────────────────────────────────────────────────────────

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;
export const CODE_LENGTH = 6;

export function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}

export function nicknameError(value: string): string | null {
  const length = value.trim().length;
  if (length < NICKNAME_MIN) return `Le pseudo doit comporter au moins ${NICKNAME_MIN} caractères.`;
  if (length > NICKNAME_MAX) return `Le pseudo ne peut pas dépasser ${NICKNAME_MAX} caractères.`;
  return null;
}
