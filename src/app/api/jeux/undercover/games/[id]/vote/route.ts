import { broadcast, undercoverChannel } from '@/lib/jeux/broadcast';
import { error, json, limitPublic, readBody, serverError, uuidParam, type Params } from '@/lib/jeux/http';
import { applyUndercover } from '@/lib/jeux/routes';
import { undercoverVoteSchema } from '@/lib/jeux/schemas';
import { hashToken } from '@/lib/jeux/tokens';
import { submitVote, toPublicState } from '@/lib/jeux/undercover-engine';

/**
 * Route publique : un joueur vote contre un autre, jeton à l'appui. Enregistré sous verrou optimiste (tout
 * le monde vote en même temps). Seul le nombre de votes est diffusé, jamais leur contenu.
 */
export async function POST(request: Request, context: Params<'id'>) {
  const limited = await limitPublic('game_play');
  if (limited) return limited;
  const id = await uuidParam(context, 'id');
  if (!id) return error('Partie introuvable', 404);
  const body = await readBody(request, undercoverVoteSchema);
  if (!body.ok) return body.response;
  const { voterId, targetId, playerToken } = body.data;
  try {
    const applied = await applyUndercover(id, (state) => submitVote(state, voterId, targetId, hashToken(playerToken)));
    if (applied.kind === 'response') return applied.response.status === 404 ? applied.response : error('Vote impossible', 400);
    await broadcast(undercoverChannel(id), 'vote_submitted', {
      voteCount: Object.keys(applied.state.votes).length,
      totalActive: Object.values(applied.state.players).filter((p) => !p.isEliminated).length,
      allVoted: applied.result.allVoted,
    });
    return json({ allVoted: applied.result.allVoted, game: toPublicState(applied.state) });
  } catch (cause) {
    return serverError('undercover vote', cause);
  }
}
