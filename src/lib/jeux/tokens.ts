import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Jeton remis à un joueur à son entrée dans une partie : il prouve que les réponses, votes et
 * lectures de rôle viennent bien de lui. Le jeton n'est jamais conservé : seule son empreinte
 * SHA-256 l'est (base ou état de la partie).
 */
export function newPlayerToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparaison en temps constant de deux empreintes hexadécimales. */
export function sameHash(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
