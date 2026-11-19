import { createHash, createPrivateKey, createPublicKey, sign, verify, type JsonWebKey, type KeyObject } from 'node:crypto';

/**
 * Open Badges 3.0 sécurisés par JWT (VC-JOSE, RS256) — module pur, sans accès à la base.
 *
 * - Le crédential est un OpenBadgeCredential au format W3C Verifiable Credentials 2.0.
 * - Il est signé en JWS compact selon Open Badges 3.0 § 8.2 : en-tête { alg: RS256, typ: JWT, kid }
 *   (aucun autre en-tête admis), charge utile = le crédential lui-même, complété des
 *   revendications JWT obligatoires iss, jti, nbf et sub (plus iat).
 * - Aucune bibliothèque externe : node:crypto suffit (RSASSA-PKCS1-v1_5 + SHA-256).
 *
 * Choix et limites : docs/open-badges.md.
 */

export const VC_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
export const OB_CONTEXT = 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json';
export const OB_SCHEMA = 'https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json';
export const JWT_ALG = 'RS256' as const;
/** OB 3.0 § 8.2.3 : « If present, MUST be set to "JWT" ». */
export const JWT_TYP = 'JWT' as const;
/** Taille minimale de clé RSA acceptée (RFC 7518 : 2 048 bits au moins pour RS256). */
export const MIN_RSA_BITS = 2048;

export type IssuerInfo = { id: string; name: string; url: string; email?: string | null };
export type AchievementInfo = {
  id: string;
  name: string;
  description: string;
  criteriaNarrative: string;
  imageUrl?: string | null;
  tags?: string[];
};

export type OpenBadgeCredential = {
  '@context': string[];
  id: string;
  type: ['VerifiableCredential', 'OpenBadgeCredential'];
  name: string;
  issuer: { id: string; type: ['Profile']; name: string; url: string; email?: string };
  validFrom: string;
  credentialSubject: {
    id: string;
    type: ['AchievementSubject'];
    identifier: { type: 'IdentityObject'; identityHash: string; identityType: 'name'; hashed: false }[];
    achievement: {
      id: string;
      type: ['Achievement'];
      name: string;
      description: string;
      criteria: { narrative: string };
      image?: { id: string; type: 'Image' };
      tag?: string[];
    };
  };
  credentialSchema: { id: string; type: '1EdTechJsonSchemaValidator2019' }[];
};

/** Date ISO 8601 à la seconde (sans millisecondes), comme dans les exemples de la spécification. */
export function isoSeconds(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function buildOpenBadgeCredential({
  id,
  issuer,
  achievement,
  subjectId,
  holderName,
  validFrom,
}: {
  id: string;
  issuer: IssuerInfo;
  achievement: AchievementInfo;
  /** Identifiant (URI) du titulaire : la revendication sub du JWT est obligatoire en OB 3.0. */
  subjectId: string;
  holderName: string;
  validFrom: Date;
}): OpenBadgeCredential {
  const tags = (achievement.tags ?? []).filter(Boolean);
  return {
    '@context': [VC_CONTEXT, OB_CONTEXT],
    id,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    name: achievement.name,
    issuer: { id: issuer.id, type: ['Profile'], name: issuer.name, url: issuer.url, ...(issuer.email ? { email: issuer.email } : {}) },
    validFrom: isoSeconds(validFrom),
    credentialSubject: {
      // Pas d'identifiant décentralisé (DID) pour les participants : identifiant opaque (urn:uuid) propre
      // au badge, et désignation du titulaire par son nom.
      id: subjectId,
      type: ['AchievementSubject'],
      identifier: [{ type: 'IdentityObject', identityHash: holderName, identityType: 'name', hashed: false }],
      achievement: {
        id: achievement.id,
        type: ['Achievement'],
        name: achievement.name,
        description: achievement.description,
        criteria: { narrative: achievement.criteriaNarrative },
        ...(achievement.imageUrl ? { image: { id: achievement.imageUrl, type: 'Image' as const } } : {}),
        ...(tags.length ? { tag: tags } : {}),
      },
    },
    credentialSchema: [{ id: OB_SCHEMA, type: '1EdTechJsonSchemaValidator2019' }],
  };
}

// ── Clés ────────────────────────────────────────────────────────────────────

export type PublicJwk = { kty: 'RSA'; n: string; e: string; alg: typeof JWT_ALG; use: 'sig'; kid: string };
export type ParsedSigningKey = { privateKey: KeyObject; publicJwk: Omit<PublicJwk, 'kid'>; thumbprint: string };

/**
 * Lit la clé privée (JWK RSA) d'une variable d'environnement : JSON brut ou JSON encodé en base64.
 * Lève une erreur explicite (sans jamais recopier la clé) si elle est absente, illisible ou trop courte.
 */
export function parseSigningKey(raw: string | null | undefined): ParsedSigningKey {
  const value = raw?.trim();
  if (!value) throw new Error('Clé de signature absente.');
  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(value.startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8')) as JsonWebKey;
  } catch {
    throw new Error('Clé de signature illisible : JWK attendue (JSON ou JSON en base64).');
  }
  if (jwk.kty !== 'RSA' || typeof jwk.d !== 'string') throw new Error('Clé de signature invalide : JWK privée RSA attendue.');
  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey({ key: jwk, format: 'jwk' });
  } catch {
    throw new Error('Clé de signature invalide.');
  }
  const bits = privateKey.asymmetricKeyDetails?.modulusLength ?? 0;
  if (bits < MIN_RSA_BITS) throw new Error(`Clé de signature trop courte : ${MIN_RSA_BITS} bits au moins.`);
  const exported = createPublicKey(privateKey).export({ format: 'jwk' });
  const publicJwk = { kty: 'RSA' as const, n: String(exported.n), e: String(exported.e), alg: JWT_ALG, use: 'sig' as const };
  return { privateKey, publicJwk, thumbprint: jwkThumbprint(publicJwk) };
}

/** Empreinte RFC 7638 d'une clé publique RSA (SHA-256, base64url). */
export function jwkThumbprint(jwk: { e: string; n: string }) {
  return createHash('sha256').update(JSON.stringify({ e: jwk.e, kty: 'RSA', n: jwk.n }), 'utf8').digest('base64url');
}

// ── JWS compact ─────────────────────────────────────────────────────────────

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

export function signCredential(credential: OpenBadgeCredential, key: { privateKey: KeyObject; kid: string }, issuedAt = new Date()): string {
  const header = { alg: JWT_ALG, typ: JWT_TYP, kid: key.kid };
  const payload = {
    ...credential,
    iss: credential.issuer.id,
    jti: credential.id,
    sub: credential.credentialSubject.id,
    nbf: Math.floor(new Date(credential.validFrom).getTime() / 1000),
    iat: Math.floor(issuedAt.getTime() / 1000),
  };
  const input = `${b64(header)}.${b64(payload)}`;
  return `${input}.${sign('sha256', Buffer.from(input, 'utf8'), key.privateKey).toString('base64url')}`;
}

export type VerifyResult =
  | { ok: true; header: { alg: string; typ?: string; kid?: string }; payload: OpenBadgeCredential & Record<string, unknown> }
  | { ok: false; reason: 'format' | 'algorithm' | 'unknown_key' | 'signature' | 'not_yet_valid' | 'claims' };

const JWS_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Vérifie un crédential signé avec les clés publiques de l'émetteur. N'accepte que RS256 (jamais « none »). */
export function verifyCredential(jwt: string, keys: PublicJwk[], now = new Date()): VerifyResult {
  if (typeof jwt !== 'string' || jwt.length > 100_000 || !JWS_PATTERN.test(jwt)) return { ok: false, reason: 'format' };
  const [encodedHeader, encodedPayload, encodedSignature] = jwt.split('.');
  let header: { alg?: unknown; typ?: unknown; kid?: unknown };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(encodedHeader!, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(encodedPayload!, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'format' };
  }
  if (!header || typeof header !== 'object' || !payload || typeof payload !== 'object') return { ok: false, reason: 'format' };
  if (header.alg !== JWT_ALG) return { ok: false, reason: 'algorithm' };
  const jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) return { ok: false, reason: 'unknown_key' };
  let valid = false;
  try {
    const publicKey = createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' });
    valid = verify('sha256', Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8'), publicKey, Buffer.from(encodedSignature!, 'base64url'));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'signature' };
  const credential = payload as OpenBadgeCredential & Record<string, unknown>;
  if (
    !Array.isArray(credential.type) ||
    !credential.type.includes('OpenBadgeCredential') ||
    credential.jti !== credential.id ||
    credential.iss !== credential.issuer?.id ||
    credential.sub !== credential.credentialSubject?.id ||
    typeof credential.nbf !== 'number' ||
    credential.nbf !== Math.floor(new Date(String(credential.validFrom)).getTime() / 1000)
  ) {
    return { ok: false, reason: 'claims' };
  }
  if ((credential.nbf as number) > Math.floor(now.getTime() / 1000) + 60) return { ok: false, reason: 'not_yet_valid' };
  return { ok: true, header: header as { alg: string; typ?: string; kid?: string }, payload: credential };
}

/** Empreinte SHA-256 (hexadécimal) du crédential signé, conservée en base. */
export function credentialSha256(jwt: string) {
  return createHash('sha256').update(jwt, 'utf8').digest('hex');
}

/**
 * Forme JSON « enveloppée » d'un crédential sécurisé par JOSE (VC Data Model 2.0, § Enveloped
 * Verifiable Credentials), proposée en second fichier (.json). Le fichier Open Badges 3.0 de
 * référence (§ 5.1) est le JWS compact brut (.jwt) ; la signature reste intacte dans les deux.
 */
export function envelopedCredential(jwt: string) {
  return { '@context': [VC_CONTEXT], id: `data:application/vc+jwt,${jwt}`, type: 'EnvelopedVerifiableCredential' };
}
