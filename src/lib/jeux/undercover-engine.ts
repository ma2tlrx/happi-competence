/**
 * Undercover : règles et transitions de l'état d'une partie. Logique pure, portée du jeu d'origine :
 * le hasard (`rng`) et l'horloge (`now`) sont injectés pour que les tests soient déterministes.
 *
 * Rôles : civils (mot commun), un « undercover » (mot proche) et, avec 4 joueurs ou plus, un
 * « Fourmi Caché » (rôle `spy`, sans mot — Mister White dans le jeu d'origine). L'animateur
 * (hôte) ne joue pas : il conduit les phases.
 *
 * Phases : lobby → role_reveal → discussion → voting → vote_result → discussion … → game_over,
 * avec spy_guess quand le Fourmi Caché est éliminé sans que la partie soit déjà jouée.
 */
import { fail, ok } from './result';
import { getRandomWordPairFromTheme, type WordPair } from './words';

export type UndercoverRole = 'civil' | 'undercover' | 'spy';
export type UndercoverStatus = 'lobby' | 'role_reveal' | 'discussion' | 'voting' | 'vote_result' | 'spy_guess' | 'game_over';
export type UndercoverWinner = 'civils' | 'undercover' | 'spy';

export type UndercoverPlayer = {
  id: string;
  nickname: string;
  isHost: boolean;
  role?: UndercoverRole;
  word?: string;
  isEliminated: boolean;
  eliminatedInRound?: number;
  joinedAt: number;
  /** Compte (profil) du joueur, jamais exposé aux écrans : vérifie que l'action vient de lui. Absent pour l'animateur. */
  userId?: string;
  /** Fiche participant (absente en mode essai et pour l'animateur). */
  participantId?: string | null;
  /** Mode essai : aucun résultat n'est enregistré. */
  trial?: boolean;
};

export type RoundResult = {
  roundNumber: number;
  votes: Record<string, string>;
  eliminatedId: string | null;
  eliminatedNickname: string | null;
  eliminatedRole: UndercoverRole | null;
  wasTie: boolean;
};

export type UndercoverState = {
  gameId: string;
  code: string;
  status: UndercoverStatus;
  hostId: string;
  players: Record<string, UndercoverPlayer>;
  /** Numéro de la manche de jeu (1, puis +1 à chaque « rejouer ») : clé d'idempotence des résultats. */
  playNumber?: number;
  themeId?: string;
  customWordPair?: WordPair;
  includeMisterWhite: boolean;
  wordPair?: WordPair;
  currentRound: number;
  roundResults: RoundResult[];
  speakingOrder: string[];
  currentSpeakerIndex: number;
  votes: Record<string, string>;
  tiebreakPlayerIds?: string[];
  winner?: UndercoverWinner;
  winnerIds?: string[];
  spyGuess?: string;
  spyGuessCorrect?: boolean;
  maxPlayers: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
};

export type Rng = () => number;

export const MAX_PLAYERS = 8;
/** Joueurs minimum (hors animateur) pour lancer la partie. */
export const MIN_PLAYERS = 3;
/** Joueurs minimum pour qu'un Fourmi Caché soit distribué. */
export const MIN_PLAYERS_FOR_SPY = 4;

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Code de partie à 6 caractères (sans 0, 1, I, O pour éviter les confusions à l'écran). */
export function generateCode(rng: Rng = Math.random): string {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(rng() * CODE_CHARS.length)]).join('');
}

export function newUndercoverGame(input: {
  gameId: string;
  code: string;
  hostId: string;
  hostNickname: string;
  themeId?: string;
  customWordPair?: WordPair;
  includeMisterWhite?: boolean;
  now: number;
}): UndercoverState {
  return {
    gameId: input.gameId,
    code: input.code,
    status: 'lobby',
    hostId: input.hostId,
    players: {
      [input.hostId]: { id: input.hostId, nickname: input.hostNickname, isHost: true, isEliminated: false, joinedAt: input.now },
    },
    playNumber: 1,
    themeId: input.themeId,
    customWordPair: input.customWordPair,
    includeMisterWhite: input.includeMisterWhite ?? true,
    currentRound: 0,
    roundResults: [],
    speakingOrder: [],
    currentSpeakerIndex: 0,
    votes: {},
    maxPlayers: MAX_PLAYERS,
    createdAt: input.now,
  };
}

export function joinGame(
  state: UndercoverState,
  input: { id: string; nickname: string; userId: string; participantId?: string | null; trial?: boolean; now: number },
) {
  if (state.status !== 'lobby') return fail('already_started');
  if (Object.keys(state.players).length >= state.maxPlayers) return fail('full');
  const taken = Object.values(state.players).some((p) => p.nickname.toLowerCase() === input.nickname.toLowerCase());
  if (taken) return fail('nickname_taken');
  state.players[input.id] = {
    id: input.id,
    nickname: input.nickname,
    isHost: false,
    isEliminated: false,
    joinedAt: input.now,
    userId: input.userId,
    participantId: input.participantId ?? null,
    trial: input.trial === true,
  };
  return ok(state.players[input.id]);
}

/** Joueur (hors animateur) correspondant au compte : reprise après déconnexion, ou refus d'une seconde place. */
export function findPlayerByUser(state: UndercoverState, userId: string): UndercoverPlayer | undefined {
  return Object.values(state.players).find((p) => !p.isHost && p.userId === userId);
}

/** L'identifiant de joueur désigne-t-il bien le compte connecté ? (Seule garantie d'identité : plus aucun jeton.) */
export function isPlayerOf(state: UndercoverState, playerId: string, userId: string): boolean {
  const player = state.players[playerId];
  return !!player && !player.isHost && !!player.userId && player.userId === userId;
}

export function getActivePlayers(state: UndercoverState): UndercoverPlayer[] {
  return Object.values(state.players).filter((p) => !p.isEliminated && !p.isHost);
}

export function assignRoles(
  playerIds: string[],
  wordPair: WordPair,
  includeMisterWhite = true,
  rng: Rng = Math.random,
): Record<string, { role: UndercoverRole; word?: string }> {
  const shuffled = shuffle(playerIds, rng);
  const roles: Record<string, { role: UndercoverRole; word?: string }> = {};
  const canHaveSpy = includeMisterWhite && playerIds.length >= MIN_PLAYERS_FOR_SPY;
  shuffled.forEach((id, i) => {
    if (i === 0) roles[id] = { role: 'undercover', word: wordPair.undercover };
    else if (i === 1 && canHaveSpy) roles[id] = { role: 'spy' };
    else roles[id] = { role: 'civil', word: wordPair.civil };
  });
  return roles;
}

export function startGame(state: UndercoverState, now: number, rng: Rng = Math.random) {
  if (state.status !== 'lobby') return fail('bad_phase');
  const nonHostIds = Object.keys(state.players).filter((id) => id !== state.hostId);
  if (nonHostIds.length < MIN_PLAYERS) return fail('not_enough_players');

  const wordPair = state.customWordPair ?? getRandomWordPairFromTheme(state.themeId, rng);
  const roleMap = assignRoles(nonHostIds, wordPair, state.includeMisterWhite, rng);
  for (const [id, { role, word }] of Object.entries(roleMap)) {
    state.players[id].role = role;
    state.players[id].word = word;
  }
  state.wordPair = wordPair;
  state.status = 'role_reveal';
  state.startedAt = now;
  state.currentRound = 1;
  state.speakingOrder = shuffle(nonHostIds, rng);
  state.currentSpeakerIndex = 0;
  state.votes = {};
  return ok(null);
}

/** Victoire éventuelle d'après les joueurs encore en jeu (hors animateur). */
export function checkWinCondition(state: UndercoverState): UndercoverWinner | null {
  const active = getActivePlayers(state);
  const activeUndercover = active.filter((p) => p.role === 'undercover');
  const activeSpy = active.filter((p) => p.role === 'spy');
  const activeCivils = active.filter((p) => p.role === 'civil');

  if (activeUndercover.length === 0 && activeSpy.length === 0) return 'civils';
  if (active.length <= 2) {
    if (activeUndercover.length > 0) return 'undercover';
    if (activeSpy.length > 0) return 'spy';
  }
  if (activeCivils.length === 0) return activeUndercover.length > 0 ? 'undercover' : 'spy';
  return null;
}

/**
 * Vote d'un joueur. Un joueur peut changer son vote tant que l'animateur n'a pas résolu le tour.
 * Pendant un départage, seuls les joueurs à égalité peuvent être désignés.
 */
export function submitVote(state: UndercoverState, voterId: string, targetId: string, userId: string) {
  if (state.status !== 'voting') return fail('bad_phase');
  if (!isPlayerOf(state, voterId, userId)) return fail('forbidden');

  const voter = state.players[voterId];
  const target = state.players[targetId];
  if (!voter || voter.isEliminated || voter.isHost) return fail('invalid_vote');
  if (!target || target.isEliminated || target.isHost) return fail('invalid_vote');
  if (voterId === targetId) return fail('invalid_vote');
  if (state.tiebreakPlayerIds?.length && !state.tiebreakPlayerIds.includes(targetId)) return fail('invalid_vote');

  state.votes[voterId] = targetId;
  const allVoted = getActivePlayers(state).every((p) => state.votes[p.id] !== undefined);
  return ok({ allVoted });
}

export type VoteResolution = { tie: true } | { tie: false };

/**
 * Dépouille le vote.
 *  - une personne a le plus de voix : elle est éliminée ;
 *  - égalité au premier tour : nouveau vote, limité aux joueurs à égalité (`tiebreakPlayerIds`) ;
 *  - égalité encore au second tour : l'un des joueurs à égalité est tiré au sort ;
 *  - personne n'a voté : même traitement, tous les joueurs en jeu étant à égalité (le jeu d'origine
 *    bouclait alors indéfiniment sur le même vote vide).
 */
export function resolveVotes(state: UndercoverState, now: number, rng: Rng = Math.random) {
  if (state.status !== 'voting') return fail('bad_phase');

  const tally: Record<string, number> = {};
  for (const targetId of Object.values(state.votes)) tally[targetId] = (tally[targetId] || 0) + 1;

  let topVoted: string[];
  if (Object.keys(tally).length === 0) {
    topVoted = (state.tiebreakPlayerIds?.length ? state.tiebreakPlayerIds : getActivePlayers(state).map((p) => p.id)).slice();
  } else {
    const maxVotes = Math.max(...Object.values(tally));
    topVoted = Object.entries(tally).filter(([, count]) => count === maxVotes).map(([id]) => id);
  }

  let eliminatedId: string | null = null;
  let wasTie = false;

  if (topVoted.length === 1) {
    eliminatedId = topVoted[0];
  } else {
    wasTie = true;
    if (state.tiebreakPlayerIds && state.tiebreakPlayerIds.length > 0) {
      eliminatedId = topVoted[Math.floor(rng() * topVoted.length)];
    } else {
      // Premier tour à égalité : on revote, entre les joueurs à égalité seulement.
      state.tiebreakPlayerIds = topVoted;
      state.votes = {};
      state.status = 'voting';
      return ok<VoteResolution>({ tie: true });
    }
  }

  const eliminated = eliminatedId ? state.players[eliminatedId] : null;
  state.roundResults.push({
    roundNumber: state.currentRound,
    votes: { ...state.votes },
    eliminatedId,
    eliminatedNickname: eliminated?.nickname ?? null,
    eliminatedRole: eliminated?.role ?? null,
    wasTie,
  });

  if (eliminatedId) {
    state.players[eliminatedId].isEliminated = true;
    state.players[eliminatedId].eliminatedInRound = state.currentRound;
  }
  state.votes = {};
  state.tiebreakPlayerIds = undefined;

  const winCondition = checkWinCondition(state);
  if (winCondition) {
    state.winner = winCondition;
    state.winnerIds = winCondition === 'civils'
      ? getActivePlayers(state).filter((p) => p.role === 'civil').map((p) => p.id)
      : getActivePlayers(state).map((p) => p.id);
    state.status = 'game_over';
    state.finishedAt = now;
  } else if (eliminated?.role === 'spy') {
    state.status = 'spy_guess';
  } else {
    state.status = 'vote_result';
  }
  return ok<VoteResolution>({ tie: false });
}

/** Début de la discussion (depuis la révélation des rôles) ou tour suivant (depuis le résultat du vote). */
export function nextRound(state: UndercoverState, rng: Rng = Math.random) {
  if (state.status !== 'vote_result' && state.status !== 'role_reveal') return fail('bad_phase');
  if (state.status === 'role_reveal') {
    state.status = 'discussion';
  } else {
    state.currentRound += 1;
    state.speakingOrder = shuffle(getActivePlayers(state).map((p) => p.id), rng);
    state.currentSpeakerIndex = 0;
    state.status = 'discussion';
  }
  return ok(null);
}

/** Passe au joueur suivant ; après le dernier, le vote s'ouvre. */
export function advanceSpeaker(state: UndercoverState) {
  if (state.status !== 'discussion') return fail('bad_phase');
  const activeSpeakers = state.speakingOrder.filter((id) => !state.players[id]?.isEliminated);
  const nextIndex = state.currentSpeakerIndex + 1;
  if (nextIndex >= activeSpeakers.length) {
    state.status = 'voting';
    state.votes = {};
  } else {
    state.currentSpeakerIndex = nextIndex;
  }
  return ok(null);
}

export function startVoting(state: UndercoverState) {
  if (state.status !== 'discussion') return fail('bad_phase');
  state.status = 'voting';
  state.votes = {};
  state.tiebreakPlayerIds = undefined;
  return ok(null);
}

/** Le Fourmi Caché éliminé tente de deviner le mot des civils. */
export function spyGuess(state: UndercoverState, spyId: string, userId: string, guess: string, now: number) {
  if (state.status !== 'spy_guess') return fail('bad_phase');
  if (!isPlayerOf(state, spyId, userId)) return fail('forbidden');
  const spy = state.players[spyId];
  if (!spy || spy.role !== 'spy') return fail('forbidden');

  const correct = guess.trim().toLowerCase() === state.wordPair?.civil.toLowerCase();
  state.spyGuess = guess;
  state.spyGuessCorrect = correct;

  if (correct) {
    state.winner = 'spy';
    state.winnerIds = [spyId];
  } else {
    state.winner = checkWinCondition(state) ?? 'civils';
    state.winnerIds = state.winner === 'civils'
      ? getActivePlayers(state).filter((p) => p.role === 'civil').map((p) => p.id)
      : getActivePlayers(state).map((p) => p.id);
  }
  state.status = 'game_over';
  state.finishedAt = now;
  return ok(null);
}

/** Nouvelle manche avec les mêmes joueurs : retour au salon, rôles et mots effacés. */
export function replayGame(state: UndercoverState) {
  if (state.status !== 'game_over') return fail('bad_phase');
  for (const player of Object.values(state.players)) {
    player.role = undefined;
    player.word = undefined;
    player.isEliminated = false;
    player.eliminatedInRound = undefined;
  }
  state.status = 'lobby';
  state.wordPair = undefined;
  state.currentRound = 0;
  state.roundResults = [];
  state.speakingOrder = [];
  state.currentSpeakerIndex = 0;
  state.votes = {};
  state.tiebreakPlayerIds = undefined;
  state.winner = undefined;
  state.winnerIds = undefined;
  state.spyGuess = undefined;
  state.spyGuessCorrect = undefined;
  state.startedAt = undefined;
  state.finishedAt = undefined;
  state.playNumber = (state.playNumber ?? 1) + 1;
  return ok(null);
}

/** Rôle et mot d'un joueur : réservés à lui seul (compte vérifié par l'appelant, voir isPlayerOf). */
export function myRole(state: UndercoverState, playerId: string) {
  const player = state.players[playerId];
  if (!player) return fail('not_found');
  if (!player.role) return fail('no_role');
  return ok({ role: player.role, word: player.word ?? null });
}

export type PublicPlayer = Omit<UndercoverPlayer, 'role' | 'word'>;

export type PublicUndercoverState = Omit<
  UndercoverState,
  'players' | 'playNumber' | 'wordPair' | 'votes' | 'customWordPair' | 'themeId' | 'spyGuess'
> & {
  players: Record<string, PublicPlayer>;
  playerCount: number;
  voteCount: number;
  wordPair?: WordPair;
};

/**
 * Vue partagée avec tous les écrans. Ni jeton, ni rôle, ni mot, ni vote en cours : le rôle
 * d'un joueur éliminé n'apparaît que dans le résultat du tour (`roundResults`), et la paire de mots
 * qu'à la fin de la partie.
 */
export function toPublicState(state: UndercoverState): PublicUndercoverState {
  const players: Record<string, PublicPlayer> = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = {
      id: p.id,
      nickname: p.nickname,
      isHost: p.isHost,
      isEliminated: p.isEliminated,
      eliminatedInRound: p.eliminatedInRound,
      joinedAt: p.joinedAt,
    };
  }
  return {
    gameId: state.gameId,
    code: state.code,
    status: state.status,
    hostId: state.hostId,
    players,
    playerCount: Object.keys(state.players).length,
    currentRound: state.currentRound,
    roundResults: state.roundResults,
    speakingOrder: state.speakingOrder,
    currentSpeakerIndex: state.currentSpeakerIndex,
    voteCount: Object.keys(state.votes).length,
    tiebreakPlayerIds: state.tiebreakPlayerIds,
    winner: state.winner,
    winnerIds: state.winnerIds,
    spyGuessCorrect: state.spyGuessCorrect,
    maxPlayers: state.maxPlayers,
    includeMisterWhite: state.includeMisterWhite,
    createdAt: state.createdAt,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    wordPair: state.status === 'game_over' ? state.wordPair : undefined,
  };
}
