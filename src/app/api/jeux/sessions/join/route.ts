import { getSessionByCode } from '@/lib/jeux/data';
import { error, json, limitPublic, readBody, serverError, serviceDb } from '@/lib/jeux/http';
import { registerPlayer } from '@/lib/jeux/quiz-join';
import { nicknameSchema, sessionJoinSchema } from '@/lib/jeux/schemas';
import { getQuizState } from '@/lib/jeux/stores';

/**
 * Route publique : un joueur rejoint une partie de Quiz avec le code et un pseudo, sans compte.
 * Limitée en débit par adresse IP. La réponse contient un jeton personnel (`playerToken`) qu'il faudra
 * présenter pour répondre : il n'est affiché qu'ici. Un pseudo « CHECK_ONLY » vérifie seulement le code.
 */
export async function POST(request: Request) {
  const limited = await limitPublic('game_join');
  if (limited) return limited;
  const body = await readBody(request, sessionJoinSchema);
  if (!body.ok) return body.response;
  const { code, nickname: rawNickname } = body.data;
  const checkOnly = rawNickname === 'CHECK_ONLY';

  let nickname = '';
  if (!checkOnly) {
    const parsed = nicknameSchema.safeParse(rawNickname);
    if (!parsed.success) return error(parsed.error.issues[0]?.message || 'Pseudo invalide.', 400);
    nickname = parsed.data;
  }

  try {
    const db = serviceDb();
    const session = await getSessionByCode(db, code);
    if (!session) return error('Code de session invalide', 404);
    if (session.status === 'finished') return error('Cette partie est terminée', 410);

    const state = await getQuizState(db, session.id);
    if (!state) return error('Cette partie est terminée', 410);
    if (state.status !== 'lobby') return error('La partie a déjà commencé', 409);
    if (checkOnly) return json({ valid: true, sessionCode: session.code });

    const joined = await registerPlayer(db, session, nickname);
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
    return json({ sessionId: session.id, playerId: joined.playerId, nickname: joined.nickname, sessionCode: session.code, playerToken: joined.playerToken });
  } catch (cause) {
    return serverError('sessions/join', cause);
  }
}
