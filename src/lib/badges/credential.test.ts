import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  buildOpenBadgeCredential,
  credentialSha256,
  envelopedCredential,
  jwkThumbprint,
  OB_CONTEXT,
  parseSigningKey,
  signCredential,
  VC_CONTEXT,
  verifyCredential,
  type PublicJwk,
} from './credential';
import { deriveBadgeStorageKey, openCredential, sealCredential } from './storage';
import { checkStoredBadge } from './verify';

/** Clé de test générée à chaque exécution : aucune clé réelle dans le dépôt. */
function testKey(bits = 2048) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: bits });
  const raw = JSON.stringify(privateKey.export({ format: 'jwk' }));
  const parsed = parseSigningKey(raw);
  const kid = `https://exemple.test/api/badges/cles/${parsed.thumbprint}`;
  const publicJwk: PublicJwk = { ...parsed.publicJwk, kid };
  return { raw, parsed, kid, publicJwk };
}

const key = testKey();
const other = testKey();
const id = 'https://exemple.test/badges/verifier/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';

function credential(overrides: Partial<Parameters<typeof buildOpenBadgeCredential>[0]> = {}) {
  return buildOpenBadgeCredential({
    id,
    issuer: { id: 'https://exemple.test/api/badges/emetteur', name: 'HAPPI Compétence', url: 'https://exemple.test' },
    achievement: {
      id: 'https://exemple.test/api/badges/modeles/1',
      name: 'Participation au programme HAPPI',
      description: 'Description de test',
      criteriaNarrative: 'Critère de test',
      imageUrl: 'https://exemple.test/brand/badge.png',
      tags: ['Coopération'],
    },
    subjectId: 'urn:uuid:3f1c2b0e-9d4a-4c1b-8e2f-0a1b2c3d4e5f',
    holderName: 'Camille Martin',
    validFrom: new Date('2026-11-18T10:00:00.123Z'),
    ...overrides,
  });
}

describe('construction du crédential Open Badges 3.0', () => {
  it('respecte la structure OpenBadgeCredential (VC 2.0)', () => {
    const vc = credential();
    expect(vc['@context']).toEqual([VC_CONTEXT, OB_CONTEXT]);
    expect(vc.type).toEqual(['VerifiableCredential', 'OpenBadgeCredential']);
    expect(vc.validFrom).toBe('2026-11-18T10:00:00Z');
    expect(vc.issuer.type).toEqual(['Profile']);
    expect(vc.credentialSubject.type).toEqual(['AchievementSubject']);
    expect(vc.credentialSubject.identifier[0]).toEqual({ type: 'IdentityObject', identityHash: 'Camille Martin', identityType: 'name', hashed: false });
    expect(vc.credentialSubject.achievement).toMatchObject({
      type: ['Achievement'],
      criteria: { narrative: 'Critère de test' },
      image: { id: 'https://exemple.test/brand/badge.png', type: 'Image' },
      tag: ['Coopération'],
    });
    expect(vc.credentialSchema[0]!.type).toBe('1EdTechJsonSchemaValidator2019');
    expect(JSON.stringify(vc)).not.toContain('"email"');
  });

  it('omet image et étiquettes absentes', () => {
    const vc = credential({
      achievement: { id: 'https://exemple.test/a', name: 'Badge', description: 'Description', criteriaNarrative: 'Critère', imageUrl: null, tags: [] },
    });
    expect(vc.credentialSubject.achievement).not.toHaveProperty('image');
    expect(vc.credentialSubject.achievement).not.toHaveProperty('tag');
  });
});

describe('clé de signature', () => {
  it('accepte une JWK privée RSA en JSON ou en base64 et en déduit la clé publique', () => {
    const fromBase64 = parseSigningKey(Buffer.from(key.raw).toString('base64'));
    expect(fromBase64.thumbprint).toBe(key.parsed.thumbprint);
    expect(key.parsed.publicJwk).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig' });
    expect(key.parsed.publicJwk).not.toHaveProperty('d');
    expect(jwkThumbprint(key.parsed.publicJwk)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('refuse une clé absente, illisible, publique, non RSA ou trop courte', () => {
    expect(() => parseSigningKey('')).toThrow();
    expect(() => parseSigningKey('pas une clé')).toThrow();
    expect(() => parseSigningKey(JSON.stringify(key.parsed.publicJwk))).toThrow(/privée/);
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'jwk' });
    expect(() => parseSigningKey(JSON.stringify(ec))).toThrow();
    const small = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ format: 'jwk' });
    expect(() => parseSigningKey(JSON.stringify(small))).toThrow(/2048/);
  });

  it('ne recopie jamais la clé dans ses messages d’erreur', () => {
    const secret = JSON.stringify({ kty: 'RSA', d: 'secret-tres-confidentiel' });
    try {
      parseSigningKey(secret);
    } catch (error) {
      expect(String(error)).not.toContain('secret-tres-confidentiel');
    }
  });
});

describe('signature et vérification (RS256)', () => {
  const jwt = signCredential(credential(), { privateKey: key.parsed.privateKey, kid: key.kid }, new Date('2026-11-18T10:00:00Z'));
  const [header, payload, signature] = jwt.split('.');

  it('produit un JWS compact vérifiable par une implémentation RSA standard', () => {
    expect(JSON.parse(Buffer.from(header!, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT', kid: key.kid });
    const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString());
    expect(claims).toMatchObject({ iss: 'https://exemple.test/api/badges/emetteur', jti: id, sub: 'urn:uuid:3f1c2b0e-9d4a-4c1b-8e2f-0a1b2c3d4e5f', nbf: 1794996000, iat: 1794996000, id });
    const publicKey = createPublicKey({ key: key.parsed.publicJwk, format: 'jwk' });
    expect(verify('sha256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature!, 'base64url'))).toBe(true);
  });

  it('vérifie un badge intact', () => {
    const result = verifyCredential(jwt, [key.publicJwk]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.credentialSubject.achievement.name).toBe('Participation au programme HAPPI');
  });

  it('rejette un contenu modifié, une autre clé, l’algorithme « none » et les formats inattendus', () => {
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), name: 'Faux badge' })).toString('base64url');
    expect(verifyCredential(`${header}.${forged}.${signature}`, [key.publicJwk])).toEqual({ ok: false, reason: 'signature' });
    expect(verifyCredential(jwt, [{ ...other.publicJwk, kid: key.kid }])).toEqual({ ok: false, reason: 'signature' });
    expect(verifyCredential(jwt, [other.publicJwk])).toEqual({ ok: false, reason: 'unknown_key' });
    const none = Buffer.from(JSON.stringify({ alg: 'none', kid: key.kid })).toString('base64url');
    expect(verifyCredential(`${none}.${payload}.${signature}`, [key.publicJwk])).toEqual({ ok: false, reason: 'algorithm' });
    for (const value of ['', 'a.b', `${jwt}.x`, `${header}.${payload}.`, 'é.é.é']) expect(verifyCredential(value, [key.publicJwk]).ok).toBe(false);
  });

  it('rejette des revendications JWT incohérentes avec le crédential (OB 3.0 § 8.2.6.1)', () => {
    const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString());
    const resign = (body: unknown) => {
      const input = `${header}.${Buffer.from(JSON.stringify(body)).toString('base64url')}`;
      return `${input}.${sign('sha256', Buffer.from(input), key.parsed.privateKey).toString('base64url')}`;
    };
    expect(verifyCredential(resign(claims), [key.publicJwk]).ok).toBe(true);
    expect(verifyCredential(resign({ ...claims, sub: 'urn:uuid:autre' }), [key.publicJwk])).toEqual({ ok: false, reason: 'claims' });
    expect(verifyCredential(resign({ ...claims, nbf: claims.nbf + 1 }), [key.publicJwk])).toEqual({ ok: false, reason: 'claims' });
    expect(verifyCredential(resign({ ...claims, iss: 'https://ailleurs.test' }), [key.publicJwk])).toEqual({ ok: false, reason: 'claims' });
  });

  it('rejette un badge pas encore valable', () => {
    expect(verifyCredential(jwt, [key.publicJwk], new Date('2026-11-17T00:00:00Z'))).toEqual({ ok: false, reason: 'not_yet_valid' });
  });

  it('enveloppe le JWT dans un fichier JSON conforme au modèle VC 2.0', () => {
    const file = envelopedCredential(jwt);
    expect(file).toEqual({ '@context': [VC_CONTEXT], id: `data:application/vc+jwt,${jwt}`, type: 'EnvelopedVerifiableCredential' });
  });
});

describe('copie chiffrée et vérification d’un badge stocké', () => {
  const storage = deriveBadgeStorageKey('secret-de-stockage-des-tests');
  const jwt = signCredential(credential(), { privateKey: key.parsed.privateKey, kid: key.kid });
  const sha = credentialSha256(jwt);

  it('chiffre et déchiffre le crédential ; une autre clé ou un chiffré altéré donnent null', () => {
    const sealed = sealCredential(jwt, storage);
    expect(sealed).not.toContain(jwt.slice(0, 40));
    expect(openCredential(sealed, storage)).toBe(jwt);
    expect(openCredential(sealed, deriveBadgeStorageKey('un-autre-secret-de-stockage'))).toBeNull();
    expect(openCredential(`${sealed.slice(0, -4)}AAAA`, storage)).toBeNull();
    expect(openCredential(null, storage)).toBeNull();
    expect(() => deriveBadgeStorageKey('court')).toThrow();
  });

  it('badge valide, révoqué, altéré ou invérifiable', () => {
    const base = { jwt, storedSha256: sha, expectedId: id, keys: [key.publicJwk] };
    expect(checkStoredBadge({ ...base, revokedAt: null }).status).toBe('valid');
    const revoked = checkStoredBadge({ ...base, revokedAt: '2026-11-20T10:00:00Z' });
    expect(revoked).toMatchObject({ status: 'revoked', revokedAt: '2026-11-20T10:00:00Z' });
    expect(checkStoredBadge({ ...base, revokedAt: null, storedSha256: '0'.repeat(64) }).status).toBe('tampered');
    expect(checkStoredBadge({ ...base, revokedAt: null, expectedId: `${id}x` }).status).toBe('tampered');
    expect(checkStoredBadge({ ...base, revokedAt: null, keys: [] }).status).toBe('unverifiable');
    expect(checkStoredBadge({ ...base, revokedAt: null, jwt: null }).status).toBe('unverifiable');
    expect(checkStoredBadge({ ...base, revokedAt: '2026-11-20T10:00:00Z', keys: [] }).status).toBe('revoked');
  });
});
