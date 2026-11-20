import { getPlayerByProfile, getSessionByCode } from '@/lib/jeux/data';
import { error, json, limitPublic, readBody, requirePlayer, serverError, serviceDb } from '@/lib/jeux/http';
import { checkNickname } from '@/lib/jeux/nickname';
import { registerPlayer } from '@/lib/jeux/quiz-join';
import { sessionJoinSchema } from '@/lib/jeux/schemas';
import { getQuizState } from '@/lib/jeux/stores';

/**
 * Un joueur rejoint une partie de Quiz avec le code et un pseudo. RÉSERVÉ aux comptes connectés : un participant
 * (résultats conservés) ou un animateur en mode essai (`trial: true`, aucun résultat). L'identité vient de la session
 * (cookies) : aucun jeton. Rejouer l'appel avec le même compte reprend la même place (même `playerId`, pseudo d'origine).
 * Limitée en débit par adresse IP. `nickname: "CHECK_ONLY"` vérifie seulement le code (sans créer de joueur).
 */
export async function POST(request: Request) {
  const limited = await limitPublic('game_join');
  if (limited) return limited;
  const guard = await requirePlayer(request);
  if (!guard.ok) return guard.response;
  const { player } = guard;
  const body = await readBody(request, sessionJoinSchema);
  if (!body.ok) return body.response;
  const { code, nickname: rawNickname, trial } = body.data;
  if (trial !== player.trial) {
    return error(
      player.trial ? 'Les animateurs rejoignent une partie en mode essai : cochez « partie d’essai ».' : 'Le mode essai est réservé aux animateurs.',
      403,
    );
  }
  const checkOnly = rawNickname === 'CHECK_ONLY';

  let nickname = '';
  if (!checkOnly) {
    const checked = checkNickname(rawNickname);
    if (!checked.ok) return error(checked.message, 400);
    nickname = checked.nickname;
  }

  try {
    const db = serviceDb();
    const session = await getSessionByCode(db, code);
    if (!session) return error('Code de session invalide', 404);
    if (session.status === 'finished') return error('Cette partie est terminée', 410);

    const state = await getQuizState(db, session.id);
    if (!state) return error('Cette partie est terminée', 410);
    const seated = !!(await getPlayerByProfile(db, session.id, player.user.id));
    if (state.status !== 'lobby' && !seated) return error('La partie a déjà commencé', 409);
    if (checkOnly) return json({ valid: true, sessionCode: session.code, sessionId: session.id });

    const account = { userId: player.user.id, participantId: player.participantId, trial: player.trial };
    const joined = await registerPlayer(db, session, account, nickname);
    if (!joined.ok) {
      const messages = {
        not_found: ['Cette partie est terminée', 410],
        already_started: ['La partie a déjà commencé', 409],
        full: ['La salle est complète', 409],
        nickname_taken: ['Ce pseudo est déjà pris', 409],
        forbidden: ['Non autorisé', 403],
        busy: ['La partie est très sollicitée : réessayez dans un instant.', 503],
      } as const;
      const [message, status] = messages[joined.code];
      return error(message, status);
    }
    return json({ sessionId: session.id, playerId: joined.playerId, nickname: joined.nickname, sessionCode: session.code, trial: joined.trial });
  } catch (cause) {
    return serverError('sessions/join', cause);
  }
}
