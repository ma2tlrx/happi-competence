import { broadcast, undercoverChannel } from '@/lib/jeux/broadcast';
import { json, serverError, type Params } from '@/lib/jeux/http';
import { applyUndercover, undercoverHost } from '@/lib/jeux/routes';
import { startGame, toPublicState } from '@/lib/jeux/undercover-engine';

/** Animateur : distribue les rôles et les mots (3 joueurs au moins, hors animateur). */
export async function POST(request: Request, context: Params<'id'>) {
  const host = await undercoverHost(request, context);
  if (!host.ok) return host.response;
  try {
    const applied = await applyUndercover(host.gameId, (state) => startGame(state, Date.now()));
    if (applied.kind === 'response') return applied.response;
    await broadcast(undercoverChannel(host.gameId), 'game_started', { status: applied.state.status });
    return json({ game: toPublicState(applied.state) });
  } catch (cause) {
    return serverError('undercover start', cause);
  }
}
