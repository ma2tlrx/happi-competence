import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Retour de la démonstration vers l'espace administrateur.
 *
 * Quand un administrateur ouvre un espace de démonstration, sa session est remplacée par celle du compte démo. Pour
 * « Quitter la démonstration » et revenir à son tableau de bord, on dépose un témoin signé (HMAC, clé serveur) qui lie
 * l'administrateur À CETTE session de démonstration et expire vite. Sans témoin valable, la sortie déconnecte simplement.
 * Le témoin seul ne donne aucun accès : la route de retour vérifie aussi que la session en cours est bien le compte démo
 * désigné, puis que l'administrateur existe toujours, actif, avec le rôle administrateur.
 */

export const DEMO_RETURN_COOKIE = 'happi_demo_return';
export const DEMO_RETURN_TTL_SECONDS = 8 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function signature(secret: string, adminId: string, demoUserId: string, expires: number) {
  return createHmac('sha256', secret).update(`demo-return|${adminId}|${demoUserId}|${expires}`).digest('base64url');
}

export function signDemoReturn(secret: string, adminId: string, demoUserId: string, now = Date.now()): string {
  const expires = Math.floor(now / 1000) + DEMO_RETURN_TTL_SECONDS;
  return `${adminId}.${demoUserId}.${expires}.${signature(secret, adminId, demoUserId, expires)}`;
}

/** Renvoie l'identifiant de l'administrateur si le témoin est authentique, non expiré et lié à ce compte démo. */
export function verifyDemoReturn(secret: string, value: string | undefined, currentUserId: string, now = Date.now()): string | null {
  if (!secret || !value) return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [adminId, demoUserId, expiresText, given] = parts as [string, string, string, string];
  const expires = Number(expiresText);
  if (!UUID.test(adminId) || !UUID.test(demoUserId) || !Number.isInteger(expires)) return null;
  if (expires < Math.floor(now / 1000) || demoUserId !== currentUserId) return null;
  const expected = Buffer.from(signature(secret, adminId, demoUserId, expires));
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? adminId : null;
}
