import 'server-only';

import { broadcast, quizChannel } from './broadcast';
import { countPlayers, createPlayer, deletePlayer, getPlayerByProfile, type Db, type Session } from './data';
import { joinLobby } from './quiz-engine';
import { mutateQuiz } from './stores';

export type JoinResult =
  | { ok: true; playerId: string; nickname: string; trial: boolean }
  | { ok: false; code: 'not_found' | 'already_started' | 'full' | 'nickname_taken' | 'forbidden' | 'busy' };

/** Compte qui joue : identité de la session connectée, jamais un jeton. */
export type JoiningAccount = { userId: string; participantId: string | null; trial: boolean };

type Entry = JoiningAccount & { id: string; nickname: string };

/** Ajoute le joueur à l'état de la salle (sous verrou optimiste) puis prévient les écrans. */
async function enterLobby(db: Db, session: Session, player: Entry): Promise<JoinResult> {
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
  return { ok: true, playerId: player.id, nickname: player.nickname, trial: player.trial };
}

/**
 * Retour d'un joueur qui a déjà sa place dans la partie (déconnexion, rechargement, second appareil) : c'est le COMPTE
 * qui le prouve. L'opération est idempotente et conserve le pseudo d'origine. Sans place : `forbidden`.
 */
export async function rejoinPlayer(db: Db, session: Session, account: JoiningAccount, expectedPlayerId?: string): Promise<JoinResult> {
  const existing = await getPlayerByProfile(db, session.id, account.userId);
  if (!existing || (expectedPlayerId && existing.id !== expectedPlayerId)) return { ok: false, code: 'forbidden' };
  return enterLobby(db, session, {
    id: existing.id,
    nickname: existing.nickname,
    userId: account.userId,
    participantId: existing.participantId,
    trial: existing.trial,
  });
}

/**
 * Entrée d'un joueur : une seule place par compte et par partie (reprise automatique si déjà inscrit), pseudo unique
 * dans la partie (contrainte en base), puis inscription dans la salle. En cas de refus, le joueur créé est retiré
 * pour ne laisser aucune ligne orpheline.
 */
export async function registerPlayer(db: Db, session: Session, account: JoiningAccount, nickname: string): Promise<JoinResult> {
  if (await getPlayerByProfile(db, session.id, account.userId)) return rejoinPlayer(db, session, account);

  // Salle pleine d'après la base : couvre les joueurs créés mais pas encore inscrits dans l'état.
  if ((await countPlayers(db, session.id)) >= session.maxPlayers) return { ok: false, code: 'full' };
  const created = await createPlayer(db, {
    sessionId: session.id,
    nickname,
    profileId: account.userId,
    participantId: account.participantId,
    trial: account.trial,
  });
  if ('nicknameTaken' in created) {
    // Double envoi du même compte : la place existe désormais, on la reprend plutôt que de refuser.
    if (await getPlayerByProfile(db, session.id, account.userId)) return rejoinPlayer(db, session, account);
    return { ok: false, code: 'nickname_taken' };
  }
  const entered = await enterLobby(db, session, { id: created.player.id, nickname, ...account });
  if (!entered.ok) await deletePlayer(db, session.id, created.player.id);
  return entered;
}
