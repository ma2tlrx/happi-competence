import { connection } from 'next/server';

import { error, json, limitPublic, readBody, requirePlayer, serverError, serviceDb, uuidParam, type Params } from '@/lib/jeux/http';
import { refusalResponse } from '@/lib/jeux/routes';
import { undercoverRoleSchema } from '@/lib/jeux/schemas';
import { getUndercoverGame } from '@/lib/jeux/stores';
import { isPlayerOf, myRole } from '@/lib/jeux/undercover-engine';

/** Joueur connecté : lit SON rôle et SON mot (le compte de la session doit être celui de `playerId`). Jamais ceux d'un autre. */
export async function POST(request: Request, context: Params<'id'>) {
  await connection();
  const limited = await limitPublic('game_play');
  if (limited) return limited;
  const guard = await requirePlayer(request);
  if (!guard.ok) return guard.response;
  const id = await uuidParam(context, 'id');
  if (!id) return error('Partie introuvable', 404);
  const body = await readBody(request, undercoverRoleSchema);
  if (!body.ok) return body.response;
  try {
    const game = await getUndercoverGame(serviceDb(), id);
    if (!game) return error('Partie introuvable', 404);
    const { playerId } = body.data;
    if (!isPlayerOf(game.state, playerId, guard.player.user.id)) return error('Non autorisé', 403);
    const role = myRole(game.state, playerId);
    return role.ok ? json(role.result) : refusalResponse(role.code === 'not_found' ? 'not_found_player' : role.code);
  } catch (cause) {
    return serverError('undercover my-role', cause);
  }
}
