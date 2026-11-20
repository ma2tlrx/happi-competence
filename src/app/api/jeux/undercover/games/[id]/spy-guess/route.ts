import { broadcast, undercoverChannel } from '@/lib/jeux/broadcast';
import { error, json, limitPublic, readBody, serverError, uuidParam, type Params } from '@/lib/jeux/http';
import { applyUndercover } from '@/lib/jeux/routes';
import { undercoverSpyGuessSchema } from '@/lib/jeux/schemas';
import { hashToken } from '@/lib/jeux/tokens';
import { spyGuess, toPublicState } from '@/lib/jeux/undercover-engine';

/** Route publique : le Fourmi Caché éliminé tente de deviner le mot des civils (jeton à l'appui). */
export async function POST(request: Request, context: Params<'id'>) {
  const limited = await limitPublic('game_play');
  if (limited) return limited;
  const id = await uuidParam(context, 'id');
  if (!id) return error('Partie introuvable', 404);
  const body = await readBody(request, undercoverSpyGuessSchema);
  if (!body.ok) return body.response;
  const { spyId, playerToken, guess } = body.data;
  try {
    const applied = await applyUndercover(id, (state) => spyGuess(state, spyId, hashToken(playerToken), guess, Date.now()));
    if (applied.kind === 'response') return applied.response.status === 404 ? applied.response : error('Devinette impossible', 400);
    const state = applied.state;
    await broadcast(undercoverChannel(id), 'spy_guess_result', {
      correct: state.spyGuessCorrect,
      guess: state.spyGuess,
      winner: state.winner,
      status: state.status,
    });
    return json({ game: toPublicState(state) });
  } catch (cause) {
    return serverError('undercover spy-guess', cause);
  }
}
