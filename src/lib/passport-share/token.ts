import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Jetons des liens de partage du passeport — module pur (aucun accès à la base).
 *
 * - Le jeton : 32 octets aléatoires, encodés en base64url (43 caractères).
 * - En base : son empreinte SHA-256 (recherche) et une copie chiffrée AES-256-GCM
 *   dont la clé n'est connue que du serveur (réaffichage du lien par son titulaire).
 * - Les adresses IP des consultations ne sont gardées que sous forme d'HMAC.
 *
 * Aucune fonction de ce module n'écrit dans les journaux : le jeton ne doit jamais y figurer.
 */

export const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CIPHER_PREFIX = 'v1.';

export function generateShareToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function isShareTokenFormat(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

/** Empreinte SHA-256 (hexadécimal) d'un jeton ; une entrée hors format est bornée avant calcul. */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token.slice(0, 256), 'utf8').digest('hex');
}

export type ShareKeys = { encryption: Buffer; ip: Buffer };

/** Dérive deux clés indépendantes (chiffrement, HMAC des IP) d'un secret serveur. */
export function deriveShareKeys(secret: string): ShareKeys {
  if (!secret || secret.length < 16) throw new Error('Secret de partage trop court (16 caractères au moins).');
  const derive = (info: string) => Buffer.from(hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.from('happi-passport-share', 'utf8'), Buffer.from(info, 'utf8'), 32));
  return { encryption: derive('token-encryption-v1'), ip: derive('ip-hmac-v1') };
}

export function encryptShareToken(token: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return CIPHER_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

/** Jeton en clair, ou null si le chiffré est altéré, illisible ou produit avec une autre clé. */
export function decryptShareToken(payload: string | null | undefined, key: Buffer): string | null {
  if (!payload?.startsWith(CIPHER_PREFIX)) return null;
  try {
    const raw = Buffer.from(payload.slice(CIPHER_PREFIX.length), 'base64url');
    if (raw.length < 12 + 16 + 1) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const token = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    return isShareTokenFormat(token) ? token : null;
  } catch {
    return null;
  }
}

/** Empreinte HMAC-SHA256 d'une adresse IP ; null si l'adresse est absente ou invraisemblable. */
export function hashIp(ip: string | null | undefined, key: Buffer): string | null {
  const value = ip?.trim().toLowerCase();
  if (!value || value.length > 64 || !/^[0-9a-f.:]+$/.test(value)) return null;
  return createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

/** Première adresse de X-Forwarded-For (posée par l'hébergeur), à défaut X-Real-IP. */
export function clientIpFrom(headers: { get(name: string): string | null }): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || null;
}
