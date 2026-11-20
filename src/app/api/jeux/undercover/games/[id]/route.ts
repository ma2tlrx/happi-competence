import { connection } from 'next/server';

import { error, json, serverError, serviceDb, uuidParam, type Params } from '@/lib/jeux/http';
import { getUndercoverGame } from '@/lib/jeux/stores';
import { toPublicState } from '@/lib/jeux/undercover-engine';

/**
 * Route publique (écrans des joueurs et de l'animateur) : état partagé de la partie. Ni jeton, ni rôle, ni
 * mot, ni vote en cours : le rôle d'un joueur éliminé n'apparaît que dans le résultat du tour, la paire de
 * mots qu'à la fin. Lecture seule, identifiant non devinable.
 */
export async function GET(_request: Request, context: Params<'id'>) {
  await connection();
  const id = await uuidParam(context, 'id');
  if (!id) return error('Partie introuvable', 404);
  try {
    const game = await getUndercoverGame(serviceDb(), id);
    if (!game) return error('Partie introuvable', 404);
    return json({ game: toPublicState(game.state) });
  } catch (cause) {
    return serverError('undercover GET', cause);
  }
}
