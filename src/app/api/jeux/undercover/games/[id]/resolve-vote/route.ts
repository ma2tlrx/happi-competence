import { broadcast, undercoverChannel } from '@/lib/jeux/broadcast';
import { json, serverError, type Params } from '@/lib/jeux/http';
import { applyUndercover, persistUndercoverEnd, undercoverHost } from '@/lib/jeux/routes';
import { resolveVotes, toPublicState } from '@/lib/jeux/undercover-engine';

/** Animateur : dépouille le vote (égalité : nouveau vote entre les joueurs à égalité, puis tirage au sort). */
export async function POST(request: Request, context: Params<'id'>) {
  const host = await undercoverHost(request, context);
  if (!host.ok) return host.response;
  try {
    const applied = await applyUndercover(host.gameId, (state) => resolveVotes(state, Date.now()));
    if (applied.kind === 'response') return applied.response;
    const state = applied.state;
    await persistUndercoverEnd(state);
    if (applied.result.tie) {
      await broadcast(undercoverChannel(host.gameId), 'tie_vote', { tiebreakPlayerIds: state.tiebreakPlayerIds });
    } else {
      await broadcast(undercoverChannel(host.gameId), 'phase_changed', { status: state.status, roundResults: state.roundResults, winner: state.winner });
    }
    return json({ game: toPublicState(state) });
  } catch (cause) {
    return serverError('undercover resolve-vote', cause);
  }
}
