import 'server-only';

import { getSupabaseUrl } from '@/lib/supabase/env';

/**
 * Diffusion d'un événement aux écrans connectés (Supabase Realtime, API REST de diffusion, clé de
 * service : serveur uniquement). Canaux `session-<id>` (Quiz) et `undercover-<id>` (Undercover), comme
 * dans le jeu d'origine.
 *
 * Règles :
 *  - le canal est public : on n'y met JAMAIS de bonne réponse avant la fin de la question, ni de rôle,
 *    de mot ou de jeton ;
 *  - rien dans la sécurité ne repose sur un événement reçu : les routes serveur restent la seule source
 *    de vérité (n'importe qui peut émettre sur un canal public) ;
 *  - un échec n'interrompt jamais l'action (pile locale sans Realtime, panne) : une ligne technique est
 *    journalisée, sans donnée de joueur ; les écrans relisent l'état par les routes GET.
 */
export async function broadcast(channelName: string, event: string, payload: unknown): Promise<void> {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
    if (!key) return;
    const response = await fetch(`${getSupabaseUrl()}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: key, authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic: channelName, event, payload, private: false }] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) console.warn(`[jeux] diffusion refusée (${response.status}) pour l'événement ${event.split(':')[0]}`);
  } catch (cause) {
    console.warn('[jeux] diffusion indisponible', cause instanceof Error ? cause.name : 'erreur');
  }
}

export const quizChannel = (sessionId: string) => `session-${sessionId}`;
export const undercoverChannel = (gameId: string) => `undercover-${gameId}`;
