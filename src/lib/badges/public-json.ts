import { NextResponse } from 'next/server';

/**
 * Réponses JSON publiques des Open Badges (profil de l'émetteur, clés, modèles) : lisibles
 * par n'importe quel vérificateur ou portefeuille (CORS ouvert, lecture seule), jamais indexées.
 */
export function publicJson(body: unknown, init: { status?: number; maxAge?: number } = {}) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Cache-Control': init.status && init.status >= 400 ? 'no-store' : `public, max-age=${init.maxAge ?? 300}`,
      'X-Robots-Tag': 'noindex',
    },
  });
}

export const notFoundJson = () => publicJson({ error: 'Introuvable.' }, { status: 404 });
