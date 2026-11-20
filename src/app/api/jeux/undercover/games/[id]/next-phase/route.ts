import { broadcast, undercoverChannel } from '@/lib/jeux/broadcast';
import { json, readBody, serverError, type Params } from '@/lib/jeux/http';
import { applyUndercover, undercoverHost } from '@/lib/jeux/routes';
import { undercoverNextPhaseSchema } from '@/lib/jeux/schemas';
import { advanceSpeaker, nextRound, startVoting, toPublicState } from '@/lib/jeux/undercover-engine';

/** Animateur : phase suivante. `action` : start_discussion (rôles → discussion, ou tour suivant), next_speaker, start_voting. */
export async function POST(request: Request, context: Params<'id'>) {
  const host = await undercoverHost(request, context);
  if (!host.ok) return host.response;
  const body = await readBody(request, undercoverNextPhaseSchema);
  if (!body.ok) return body.response;
  const { action } = body.data;
  try {
    const applied = await applyUndercover(host.gameId, (state) =>
      action === 'start_discussion' ? nextRound(state) : action === 'next_speaker' ? advanceSpeaker(state) : startVoting(state),
    );
    if (applied.kind === 'response') return applied.response;
    const state = applied.state;
    await broadcast(undercoverChannel(host.gameId), 'phase_changed', {
      status: state.status,
      speakingOrder: state.speakingOrder,
      currentSpeakerIndex: state.currentSpeakerIndex,
      currentRound: state.currentRound,
    });
    return json({ game: toPublicState(state) });
  } catch (cause) {
    return serverError('undercover next-phase', cause);
  }
}
