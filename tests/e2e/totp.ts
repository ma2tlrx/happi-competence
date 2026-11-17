import { createHmac } from 'node:crypto';

/** Décodage Base32 (RFC 4648), alphabet des clés TOTP. */
function base32(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.replace(/[\s=]/g, '').toUpperCase()) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error(`Clé TOTP invalide : ${char}`);
    bits += value.toString(2).padStart(5, '0');
  }
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
}

/** Numéro du pas de 30 secondes en cours. */
export const totpStep = (at = Date.now()) => Math.floor(at / 1000 / 30);

/** Code TOTP à 6 chiffres (RFC 6238 : HMAC-SHA1, pas de 30 secondes). */
export function totp(secret: string, at = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(totpStep(at)));
  const digest = createHmac('sha1', base32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}
