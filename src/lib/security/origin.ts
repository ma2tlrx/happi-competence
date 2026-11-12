import 'server-only';

import { createHmac } from 'node:crypto';

import { headers } from 'next/headers';

/**
 * Empreinte de l'origine d'une requête : seule une empreinte HMAC de l'adresse IP est
 * conservée. HMAC à clé secrète serveur : sans la clé, l'empreinte ne permet pas de
 * retrouver l'adresse IP (un simple SHA-256 d'une IPv4 se retrouve par essai exhaustif).
 * Le préfixe `purpose` sépare les usages (contact, émargement) : deux empreintes d'une
 * même adresse ne sont pas rapprochables d'un usage à l'autre.
 */
export function hashIp(ip: string, purpose: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? '';
  return createHmac('sha256', `${purpose}:${secret}`).update(ip).digest('hex');
}

/** Adresse IP (premier saut) et navigateur (tronqué) de la requête en cours. */
export async function requestOrigin(purpose: string, userAgentLength = 200) {
  const requestHeaders = await headers();
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip') || 'inconnue';
  const userAgent = (requestHeaders.get('user-agent') ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, userAgentLength) || null;
  return { ipHash: hashIp(ip, purpose), userAgent };
}
