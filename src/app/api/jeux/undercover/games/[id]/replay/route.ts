import { broadcast, undercoverChannel } from '@/lib/jeux/broadcast';
import { json, serverError, type Params } from '@/lib/jeux/http';
import { applyUndercover, undercoverHost } from '@/lib/jeux/routes';
import { replayGame, toPublicState } from '@/lib/jeux/undercover-engine';

/** Animateur : rejoue avec les mêmes joueurs (retour au salon, rôles effacés). */
export async function POST(request: Request, context: Params<'id'>) {
  const host = await undercoverHost(request, context);
  if (!host.ok) return host.response;
  try {
    const applied = await applyUndercover(host.gameId, (state) => replayGame(state));
    if (applied.kind === 'response') return applied.response;
    await broadcast(undercoverChannel(host.gameId), 'phase_changed', { status: 'lobby' });
    return json({ game: toPublicState(applied.state) });
  } catch (cause) {
    return serverError('undercover replay', cause);
  }
}
