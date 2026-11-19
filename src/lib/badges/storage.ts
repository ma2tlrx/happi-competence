import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Copie chiffrée du crédential signé (AES-256-GCM, clé hors base) — module pur.
 *
 * Le crédential contient l'adresse de vérification, donc l'identifiant public (jeton) du badge.
 * La base n'en garde que l'empreinte (recherche) et cette copie chiffrée, que le serveur
 * déchiffre pour le titulaire (téléchargement) et pour la page publique de vérification.
 */

const PREFIX = 'v1.';

export function deriveBadgeStorageKey(secret: string): Buffer {
  if (!secret || secret.length < 16) throw new Error('Secret de stockage des badges trop court (16 caractères au moins).');
  return Buffer.from(hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.from('happi-open-badges', 'utf8'), Buffer.from('credential-encryption-v1', 'utf8'), 32));
}

export function sealCredential(jwt: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(jwt, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

/** Crédential en clair, ou null si le chiffré est altéré, illisible ou produit avec une autre clé. */
export function openCredential(payload: string | null | undefined, key: Buffer): string | null {
  if (!payload?.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(payload.slice(PREFIX.length), 'base64url');
    if (raw.length < 12 + 16 + 1) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
