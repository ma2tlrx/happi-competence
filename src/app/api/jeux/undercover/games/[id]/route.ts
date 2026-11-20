import { connection } from 'next/server';

import { error, json, requireViewer, serverError, serviceDb, uuidParam, type Params } from '@/lib/jeux/http';
import { canReadUndercover } from '@/lib/jeux/routes';
import { getUndercoverGame } from '@/lib/jeux/stores';
import { toPublicState } from '@/lib/jeux/undercover-engine';

/**
 * État partagé de la partie pour les écrans des joueurs et de l'animateur. Réservé aux comptes connectés qui ont une
 * place dans CETTE partie (ou qui l'animent), sinon 401 / 403 / 404. Ni jeton, ni rôle, ni mot, ni vote en cours : le rôle
 * d'un joueur éliminé n'apparaît que dans le résultat du tour, la paire de mots qu'à la fin. Lecture seule.
 */
export async function GET(_request: Request, context: Params<'id'>) {
  await connection();
  const id = await uuidParam(context, 'id');
  if (!id) return error('Partie introuvable', 404);
  const viewer = await requireViewer();
  if (!viewer.ok) return viewer.response;
  try {
    const game = await getUndercoverGame(serviceDb(), id);
    if (!game || !canReadUndercover(viewer, game)) return error('Partie introuvable', 404);
    return json({ game: toPublicState(game.state) });
  } catch (cause) {
    return serverError('undercover GET', cause);
  }
}
