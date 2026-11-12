import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { clientIpFrom, decryptShareToken, deriveShareKeys, encryptShareToken, generateShareToken, hashIp, hashShareToken, isShareTokenFormat } from './token';

const keys = deriveShareKeys('secret-de-test-assez-long');

describe('jetons de partage', () => {
  it('32 octets aléatoires en base64url, tous différents', () => {
    const tokens = new Set(Array.from({ length: 200 }, generateShareToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(isShareTokenFormat(token)).toBe(true);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    }
  });

  it('refuse les formats inattendus', () => {
    for (const value of ['', 'abc', `${generateShareToken()}=`, 'a'.repeat(44), '../'.repeat(15), null, 42]) expect(isShareTokenFormat(value)).toBe(false);
  });

  it('empreinte SHA-256 hexadécimale, déterministe, distincte du jeton', () => {
    const token = generateShareToken();
    const hash = hashShareToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hash).not.toContain(token);
    expect(hashShareToken('x'.repeat(10_000))).toMatch(/^[0-9a-f]{64}$/);
  });

  it('chiffrement réversible avec la bonne clé seulement, chiffré non déterministe et sans le jeton en clair', () => {
    const token = generateShareToken();
    const a = encryptShareToken(token, keys.encryption);
    const b = encryptShareToken(token, keys.encryption);
    expect(a).not.toBe(b);
    expect(a).not.toContain(token);
    expect(a.length).toBeLessThanOrEqual(200);
    expect(decryptShareToken(a, keys.encryption)).toBe(token);
    expect(decryptShareToken(a, deriveShareKeys('une-autre-cle-secrete').encryption)).toBeNull();
  });

  it('un chiffré altéré ou illisible donne null', () => {
    const payload = encryptShareToken(generateShareToken(), keys.encryption);
    const tampered = payload.slice(0, -2) + (payload.endsWith('A') ? 'BB' : 'AA');
    expect(decryptShareToken(tampered, keys.encryption)).toBeNull();
    expect(decryptShareToken('v1.', keys.encryption)).toBeNull();
    expect(decryptShareToken('n’importe quoi', keys.encryption)).toBeNull();
    expect(decryptShareToken(null, keys.encryption)).toBeNull();
  });

  it('clés indépendantes et secret minimal', () => {
    expect(keys.encryption.equals(keys.ip)).toBe(false);
    expect(() => deriveShareKeys('court')).toThrow();
  });

  it('IP : HMAC seulement, jamais l’adresse en clair', () => {
    const hash = hashIp('203.0.113.7', keys.ip)!;
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('203');
    expect(hashIp(' 203.0.113.7 ', keys.ip)).toBe(hash);
    expect(hashIp('2001:db8::1', keys.ip)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp('<script>', keys.ip)).toBeNull();
    expect(hashIp(null, keys.ip)).toBeNull();
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(clientIpFrom(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientIpFrom(new Headers())).toBeNull();
  });
});
