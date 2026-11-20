import { broadcast, undercoverChannel } from '@/lib/jeux/broadcast';
import { error, json, limitPublic, readBody, requirePlayer, serverError, uuidParam, type Params } from '@/lib/jeux/http';
import { ok } from '@/lib/jeux/result';
import { applyUndercover } from '@/lib/jeux/routes';
import { undercoverJoinSchema } from '@/lib/jeux/schemas';
import { findPlayerByUser, joinGame, toPublicState } from '@/lib/jeux/undercover-engine';

/**
 * Joueur connecté : rejoint la salle d'une partie d'Undercover avec un pseudo. Participant (résultats conservés) ou animateur
 * en mode essai (`trial: true`, aucun résultat). L'identité vient de la session (aucun jeton). Une seule place par compte :
 * rejouer l'appel reprend la même place (même `playerId`, pseudo d'origine), même une fois la partie commencée.
 */
export async function POST(request: Request, context: Params<'id'>) {
  const limited = await limitPublic('game_join');
  if (limited) return limited;
  const guard = await requirePlayer(request);
  if (!guard.ok) return guard.response;
  const { player } = guard;
  const id = await uuidParam(context, 'id');
  if (!id) return error('Partie introuvable', 404);
  const body = await readBody(request, undercoverJoinSchema);
  if (!body.ok) return body.response;
  if (body.data.trial !== player.trial) {
    return error(
      player.trial ? 'Les animateurs rejoignent une partie en mode essai : cochez « partie d’essai ».' : 'Le mode essai est réservé aux animateurs.',
      403,
    );
  }
  try {
    const playerId = crypto.randomUUID();
    const applied = await applyUndercover(id, (state) => {
      const seated = findPlayerByUser(state, player.user.id);
      if (seated) return ok(seated);
      return joinGame(state, {
        id: playerId,
        nickname: body.data.nickname,
        userId: player.user.id,
        participantId: player.participantId,
        trial: player.trial,
        now: Date.now(),
      });
    });
    if (applied.kind === 'response') {
      // Message du jeu d'origine pour la salle pleine / pseudo pris ; les autres refus gardent leur libellé.
      return applied.response.status === 409 ? error('Pseudo déjà pris, partie pleine ou déjà commencée', 409) : applied.response;
    }
    await broadcast(undercoverChannel(id), 'player_joined', { players: Object.values(toPublicState(applied.state).players) });
    return json({ playerId: applied.result.id, nickname: applied.result.nickname, trial: applied.result.trial === true });
  } catch (cause) {
    return serverError('undercover join', cause);
  }
}
