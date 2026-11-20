import 'server-only';

import { broadcast, quizChannel } from './broadcast';
import { countPlayers, createPlayer, deletePlayer, getPlayerTokenHash, type Db, type Session } from './data';
import { joinLobby } from './quiz-engine';
import { mutateQuiz } from './stores';
import { hashToken, newPlayerToken, sameHash } from './tokens';

export type JoinResult =
  | { ok: true; playerId: string; nickname: string; playerToken?: string }
  | { ok: false; code: 'not_found' | 'already_started' | 'full' | 'nickname_taken' | 'forbidden' | 'busy' };

/** Ajoute le joueur à l'état de la salle (sous verrou optimiste) puis prévient les écrans. */
async function enterLobby(db: Db, session: Session, player: { id: string; nickname: string; tokenHash: string }): Promise<JoinResult> {
  const outcome = await mutateQuiz<null, 'already_started' | 'full' | 'nickname_taken' | 'forbidden'>(db, session.id, (state) => {
    const result = joinLobby(state, player);
    return result.ok ? { state, result: null } : { reject: result.code as 'already_started' | 'full' | 'nickname_taken' | 'forbidden' };
  });
  if (outcome.kind === 'missing') return { ok: false, code: 'not_found' };
  if (outcome.kind === 'conflict') return { ok: false, code: 'busy' };
  if (outcome.kind === 'rejected') return { ok: false, code: outcome.reason };
  await broadcast(quizChannel(session.id), 'lobby:updated', {
    players: Object.values(outcome.state.players).map((p) => ({ id: p.id, nickname: p.nickname })),
  });
  return { ok: true, playerId: player.id, nickname: player.nickname };
}

/**
 * Entrée d'un nouveau joueur : pseudo unique dans la partie (contrainte en base), jeton remis une seule
 * fois (seule son empreinte est conservée), puis inscription dans la salle. En cas de refus, le joueur
 * créé est retiré pour ne laisser aucune ligne orpheline.
 */
export async function registerPlayer(db: Db, session: Session, nickname: string): Promise<JoinResult> {
  // Salle pleine d'après la base : couvre les joueurs créés mais pas encore inscrits dans l'état.
  if ((await countPlayers(db, session.id)) >= session.maxPlayers) return { ok: false, code: 'full' };
  const token = newPlayerToken();
  const created = await createPlayer(db, { sessionId: session.id, nickname, tokenHash: hashToken(token) });
  if ('nicknameTaken' in created) return { ok: false, code: 'nickname_taken' };
  const entered = await enterLobby(db, session, { id: created.player.id, nickname, tokenHash: hashToken(token) });
  if (!entered.ok) {
    await deletePlayer(db, session.id, created.player.id);
    return entered;
  }
  return { ok: true, playerId: created.player.id, nickname, playerToken: token };
}

/**
 * Retour d'un joueur déjà créé (route /quiz/[id]/join du jeu d'origine) : le jeton prouve son identité ;
 * l'opération est idempotente.
 */
export async function rejoinPlayer(db: Db, session: Session, playerId: string, playerToken: string): Promise<JoinResult> {
  const row = await getPlayerTokenHash(db, session.id, playerId);
  if (!row || !sameHash(row.tokenHash, hashToken(playerToken))) return { ok: false, code: 'forbidden' };
  return enterLobby(db, session, { id: playerId, nickname: row.nickname, tokenHash: row.tokenHash });
}
