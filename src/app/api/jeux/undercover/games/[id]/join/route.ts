import { broadcast, undercoverChannel } from '@/lib/jeux/broadcast';
import { error, json, limitPublic, readBody, serverError, uuidParam, type Params } from '@/lib/jeux/http';
import { applyUndercover } from '@/lib/jeux/routes';
import { undercoverJoinSchema } from '@/lib/jeux/schemas';
import { hashToken, newPlayerToken } from '@/lib/jeux/tokens';
import { joinGame, toPublicState } from '@/lib/jeux/undercover-engine';

/** Route publique : un joueur rejoint la salle d'une partie d'Undercover avec un pseudo. Le jeton personnel n'est renvoyé qu'ici. */
export async function POST(request: Request, context: Params<'id'>) {
  const limited = await limitPublic('game_join');
  if (limited) return limited;
  const id = await uuidParam(context, 'id');
  if (!id) return error('Partie introuvable', 404);
  const body = await readBody(request, undercoverJoinSchema);
  if (!body.ok) return body.response;
  try {
    const token = newPlayerToken();
    const playerId = crypto.randomUUID();
    const applied = await applyUndercover(id, (state) =>
      joinGame(state, { id: playerId, nickname: body.data.nickname, tokenHash: hashToken(token), now: Date.now() }),
    );
    if (applied.kind === 'response') {
      // Message du jeu d'origine pour la salle pleine / pseudo pris ; les autres refus gardent leur libellé.
      return applied.response.status === 409 ? error('Pseudo déjà pris, partie pleine ou déjà commencée', 409) : applied.response;
    }
    await broadcast(undercoverChannel(id), 'player_joined', { players: Object.values(toPublicState(applied.state).players) });
    return json({ playerId, playerToken: token, nickname: applied.result.nickname });
  } catch (cause) {
    return serverError('undercover join', cause);
  }
}
