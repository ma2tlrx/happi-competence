import { connection } from 'next/server';

import { error, json, limitPublic, purgeExpired, readBody, requireManager, requireViewer, serverError, serviceDb } from '@/lib/jeux/http';
import { gameCodeSchema, undercoverCreateSchema } from '@/lib/jeux/schemas';
import { getUndercoverGameByCode, insertUndercoverGame } from '@/lib/jeux/stores';
import { findPlayerByUser, generateCode, newUndercoverGame, toPublicState } from '@/lib/jeux/undercover-engine';

/**
 * Animateur (formateur ou administrateur autorisé) : crée une partie d'Undercover. L'animateur ne joue pas :
 * il conduit les phases ; son `playerId` de partie est renvoyé pour la forme, mais ses droits viennent de son compte
 * et de la propriété de la partie (aucun jeton).
 * Les mots viennent du corps (`civilWord`, `undercoverWord`) ou d'un thème (`themeId`, paire tirée au hasard au départ).
 */
export async function POST(request: Request) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;
  const body = await readBody(request, undercoverCreateSchema);
  if (!body.ok) return body.response;
  const { nickname, civilWord, undercoverWord, themeId, includeMisterWhite } = body.data;

  try {
    await purgeExpired();
    const db = serviceDb();
    const hostId = crypto.randomUUID();
    for (let attempt = 0; attempt < 10; attempt++) {
      const state = newUndercoverGame({
        gameId: crypto.randomUUID(),
        code: generateCode(),
        hostId,
        hostNickname: nickname ?? 'Animateur',
        themeId,
        customWordPair: civilWord && undercoverWord ? { civil: civilWord, undercover: undercoverWord } : undefined,
        includeMisterWhite: includeMisterWhite !== false,
        now: Date.now(),
      });
      if (await insertUndercoverGame(db, guard.manager.user.id, state)) {
        return json({ gameId: state.gameId, code: state.code, playerId: hostId, isHost: true });
      }
    }
    return error('Aucun code de partie disponible. Réessayez.', 503);
  } catch (cause) {
    return serverError('undercover create', cause);
  }
}

/**
 * Joueur connecté (participant, ou animateur en mode essai) : retrouve une partie en attente par son code (`?code=ABC234`).
 * Limitée en débit par adresse IP ; sans connexion : 401.
 */
export async function GET(request: Request) {
  await connection();
  const limited = await limitPublic('game_join');
  if (limited) return limited;
  const viewer = await requireViewer();
  if (!viewer.ok) return viewer.response;
  const parsed = gameCodeSchema.safeParse(new URL(request.url).searchParams.get('code') ?? '');
  if (!parsed.success) return error(new URL(request.url).searchParams.get('code') ? 'Code de partie invalide.' : 'Code manquant', 400);
  try {
    const state = await getUndercoverGameByCode(serviceDb(), parsed.data);
    if (!state) return error('Partie introuvable', 404);
    // Un joueur déjà inscrit retrouve sa partie même commencée (reprise) ; les autres seulement au salon.
    if (state.status !== 'lobby' && !findPlayerByUser(state, viewer.user.id)) return error('Partie déjà commencée', 409);
    return json({ game: toPublicState(state) });
  } catch (cause) {
    return serverError('undercover by code', cause);
  }
}
