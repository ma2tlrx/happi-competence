import { broadcast, undercoverChannel } from '@/lib/jeux/broadcast';
import { error, json, serverError, serviceDb, type Params } from '@/lib/jeux/http';
import { undercoverHost } from '@/lib/jeux/routes';
import { deleteUndercoverGame } from '@/lib/jeux/stores';

/** Animateur : annule une partie qui n'a pas commencé (l'état est supprimé). */
export async function POST(request: Request, context: Params<'id'>) {
  const host = await undercoverHost(request, context);
  if (!host.ok) return host.response;
  if (host.state.status !== 'lobby') return error('Partie déjà commencée', 409);
  try {
    await deleteUndercoverGame(serviceDb(), host.gameId);
    await broadcast(undercoverChannel(host.gameId), 'game_cancelled', {});
    return json({ ok: true });
  } catch (cause) {
    return serverError('undercover cancel', cause);
  }
}
