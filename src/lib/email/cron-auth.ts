import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Vérifie l'en-tête « Authorization: Bearer <CRON_SECRET> » envoyé par la planification Vercel.
 * Comparaison à temps constant sur les empreintes (longueurs identiques quel que soit le jeton).
 * Sans secret configuré, tout appel est refusé.
 */
export function isAuthorizedCron(header: string | null | undefined, secret: string | null | undefined): boolean {
  const expected = secret?.trim();
  if (!expected || expected.length < 16) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? '');
  const provided = match?.[1]?.trim() ?? '';
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(provided), digest(expected)) && provided.length > 0;
}
