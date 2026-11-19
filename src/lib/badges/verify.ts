import { credentialSha256, verifyCredential, type OpenBadgeCredential, type PublicJwk } from './credential';

/**
 * Décision de la page publique de vérification — module pur.
 * La signature, l'empreinte conservée en base, l'adresse du badge et la révocation sont
 * toutes contrôlées : un badge révoqué reste « révoqué » même si sa signature est intacte.
 */
export type BadgeCheck =
  | { status: 'valid'; credential: OpenBadgeCredential }
  | { status: 'revoked'; credential: OpenBadgeCredential | null; revokedAt: string }
  /** Signature, empreinte ou contenu ne correspondent pas : document altéré. */
  | { status: 'tampered' }
  /** Vérification impossible (clé de signature non configurée ou remplacée, copie illisible). */
  | { status: 'unverifiable' };

export function checkStoredBadge({
  jwt,
  storedSha256,
  expectedId,
  revokedAt,
  keys,
  now = new Date(),
}: {
  jwt: string | null;
  storedSha256: string;
  expectedId: string;
  revokedAt: string | null;
  keys: PublicJwk[];
  now?: Date;
}): BadgeCheck {
  if (!jwt) return revokedAt ? { status: 'revoked', credential: null, revokedAt } : { status: 'unverifiable' };
  if (credentialSha256(jwt) !== storedSha256) return { status: 'tampered' };
  const result = verifyCredential(jwt, keys, now);
  if (!result.ok) {
    if (revokedAt) return { status: 'revoked', credential: null, revokedAt };
    return result.reason === 'unknown_key' ? { status: 'unverifiable' } : { status: 'tampered' };
  }
  if (result.payload.id !== expectedId) return { status: 'tampered' };
  if (revokedAt) return { status: 'revoked', credential: result.payload, revokedAt };
  return { status: 'valid', credential: result.payload };
}
