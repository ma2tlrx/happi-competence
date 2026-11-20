import { connection } from 'next/server';

import { error, json, limitPublic, readBody, serverError, serviceDb, uuidParam, type Params } from '@/lib/jeux/http';
import { refusalResponse } from '@/lib/jeux/routes';
import { undercoverRoleSchema } from '@/lib/jeux/schemas';
import { getUndercoverGame } from '@/lib/jeux/stores';
import { hashToken, sameHash } from '@/lib/jeux/tokens';
import { myRole } from '@/lib/jeux/undercover-engine';

/** Route publique : un joueur lit SON rôle et SON mot, jeton à l'appui. Jamais ceux d'un autre. */
export async function POST(request: Request, context: Params<'id'>) {
  await connection();
  const limited = await limitPublic('game_play');
  if (limited) return limited;
  const id = await uuidParam(context, 'id');
  if (!id) return error('Partie introuvable', 404);
  const body = await readBody(request, undercoverRoleSchema);
  if (!body.ok) return body.response;
  try {
    const game = await getUndercoverGame(serviceDb(), id);
    if (!game) return error('Partie introuvable', 404);
    const { playerId, playerToken } = body.data;
    if (!sameHash(game.state.playerTokenHashes[playerId], hashToken(playerToken))) return error('Non autorisé', 403);
    const role = myRole(game.state, playerId);
    return role.ok ? json(role.result) : refusalResponse(role.code === 'not_found' ? 'not_found_player' : role.code);
  } catch (cause) {
    return serverError('undercover my-role', cause);
  }
}
