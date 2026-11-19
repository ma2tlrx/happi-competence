import 'server-only';

import { randomUUID } from 'node:crypto';

import { siteConfig } from '@/config/site';
import { generateShareToken, hashShareToken, isShareTokenFormat } from '@/lib/passport-share/token';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/database.types';
import type { ServerClient } from '@/lib/supabase/server';

import {
  buildOpenBadgeCredential,
  credentialSha256,
  parseSigningKey,
  signCredential,
  type AchievementInfo,
  type IssuerInfo,
  type OpenBadgeCredential,
  type PublicJwk,
} from './credential';
import { deriveBadgeStorageKey, openCredential, sealCredential } from './storage';
import { checkStoredBadge, type BadgeCheck } from './verify';

/**
 * Open Badges, côté serveur : clé de signature, adresses publiques, émission, téléchargement
 * et vérification publique. La clé privée ne vient que de OPEN_BADGES_SIGNING_KEY (jamais du
 * code ni de la base) ; sans elle, l'émission est désactivée et la page de vérification
 * indique qu'elle ne peut pas contrôler la signature.
 */

export function badgeOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || siteConfig.url).replace(/\/+$/, '');
}

export const badgeUrls = {
  issuer: () => `${badgeOrigin()}/api/badges/emetteur`,
  jwks: () => `${badgeOrigin()}/api/badges/jwks`,
  key: (thumbprint: string) => `${badgeOrigin()}/api/badges/cles/${thumbprint}`,
  achievement: (badgeClassId: string) => `${badgeOrigin()}/api/badges/modeles/${badgeClassId}`,
  verify: (token: string) => `${badgeOrigin()}/badges/verifier/${token}`,
};

export function issuerInfo(): IssuerInfo {
  return { id: badgeUrls.issuer(), name: siteConfig.name, url: badgeOrigin(), email: siteConfig.contactEmail };
}

/** Chemin du site (/brand/…) → adresse absolue ; une adresse https reste telle quelle. */
export function absoluteImage(imageUrl: string | null | undefined) {
  if (!imageUrl) return null;
  return imageUrl.startsWith('/') ? `${badgeOrigin()}${imageUrl}` : imageUrl;
}

/**
 * Image affichable dans les pages du site : la politique de sécurité du contenu n'autorise que
 * les images du site lui-même ; une image hébergée ailleurs n'est pas affichée (icône à la place).
 */
export function localImagePath(imageUrl: string | null | undefined) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('/')) return imageUrl;
  const origin = badgeOrigin();
  return imageUrl.startsWith(`${origin}/`) ? imageUrl.slice(origin.length) : null;
}

// ── Clé de signature ────────────────────────────────────────────────────────

type Signing = { ok: true; privateKey: ReturnType<typeof parseSigningKey>['privateKey']; publicJwk: PublicJwk; thumbprint: string } | { ok: false; reason: 'missing' | 'invalid'; message: string };
let cachedSigning: { raw: string | undefined; value: Signing } | null = null;

/** État de la clé de signature. Le message d'erreur ne contient jamais la clé. */
export function badgeSigning(): Signing {
  const raw = process.env.OPEN_BADGES_SIGNING_KEY;
  if (cachedSigning && cachedSigning.raw === raw) return cachedSigning.value;
  let value: Signing;
  if (!raw?.trim()) {
    value = { ok: false, reason: 'missing', message: 'La clé de signature des badges (OPEN_BADGES_SIGNING_KEY) n’est pas configurée.' };
  } else {
    try {
      const parsed = parseSigningKey(raw);
      value = { ok: true, privateKey: parsed.privateKey, thumbprint: parsed.thumbprint, publicJwk: { ...parsed.publicJwk, kid: badgeUrls.key(parsed.thumbprint) } };
    } catch (error) {
      value = { ok: false, reason: 'invalid', message: `Clé de signature des badges inutilisable : ${error instanceof Error ? error.message : 'format inattendu'}` };
    }
  }
  cachedSigning = { raw, value };
  return value;
}

/** Clés publiques de vérification (JWKS). Vide si la signature n'est pas configurée. */
export function publicKeys(): PublicJwk[] {
  const signing = badgeSigning();
  return signing.ok ? [signing.publicJwk] : [];
}

let cachedStorage: Buffer | null = null;

/** Clé de chiffrement des crédentials stockés : secret dédié, à défaut celui du partage de passeport ou la clé de service. */
export function badgeStorageKey(): Buffer {
  if (cachedStorage) return cachedStorage;
  const secret =
    process.env.OPEN_BADGES_STORAGE_SECRET ?? process.env.PASSPORT_SHARE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Configuration manquante : OPEN_BADGES_STORAGE_SECRET (côté serveur uniquement).');
  cachedStorage = deriveBadgeStorageKey(secret);
  return cachedStorage;
}

// ── Émission ────────────────────────────────────────────────────────────────

export type BadgeClassRow = {
  id: string;
  name: string;
  description: string;
  criteria_narrative: string;
  image_url: string | null;
  related_skills: Json;
};

export function achievementOf(badgeClass: BadgeClassRow): AchievementInfo {
  const tags = Array.isArray(badgeClass.related_skills)
    ? badgeClass.related_skills.map((skill) => (skill && typeof skill === 'object' && !Array.isArray(skill) ? String(skill.name ?? '') : '')).filter(Boolean)
    : [];
  return {
    id: badgeUrls.achievement(badgeClass.id),
    name: badgeClass.name,
    description: badgeClass.description,
    criteriaNarrative: badgeClass.criteria_narrative,
    imageUrl: absoluteImage(badgeClass.image_url),
    tags,
  };
}

/**
 * Signe et enregistre un badge. Le rôle administrateur doit avoir été vérifié par l'appelant ;
 * la base le revérifie (issue_badge_assertion), avec l'état du modèle et l'absence de doublon.
 */
export async function signAndIssueBadge(
  supabase: ServerClient,
  input: { badgeClass: BadgeClassRow; participant: { id: string; firstName: string; lastName: string }; groupId: string | null; snapshot: Json },
): Promise<{ ok: true; id: string } | { ok: false; error: { code?: string; message?: string } | null; message?: string }> {
  const signing = badgeSigning();
  if (!signing.ok) return { ok: false, error: null, message: signing.message };
  const token = generateShareToken();
  const issuedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  const credential = buildOpenBadgeCredential({
    id: badgeUrls.verify(token),
    issuer: issuerInfo(),
    achievement: achievementOf(input.badgeClass),
    subjectId: `urn:uuid:${randomUUID()}`,
    holderName: `${input.participant.firstName} ${input.participant.lastName}`,
    validFrom: issuedAt,
  });
  const jwt = signCredential(credential, { privateKey: signing.privateKey, kid: signing.publicJwk.kid }, issuedAt);
  const { data, error } = await supabase.rpc('issue_badge_assertion', {
    p_badge_class_id: input.badgeClass.id,
    p_participant_id: input.participant.id,
    p_group_id: input.groupId ?? undefined,
    p_issued_at: issuedAt.toISOString(),
    p_public_id_hash: hashShareToken(token),
    p_credential_sha256: credentialSha256(jwt),
    p_credential_ciphertext: sealCredential(jwt, badgeStorageKey()),
    p_signing_kid: signing.publicJwk.kid,
    p_award_snapshot: input.snapshot,
  });
  if (error || typeof data !== 'string') return { ok: false, error };
  return { ok: true, id: data };
}

// ── Téléchargement par le titulaire ─────────────────────────────────────────

/** Crédential signé d'un badge : titulaire (badge non révoqué) ou administrateur, contrôlé par la base. */
export async function revealCredential(supabase: ServerClient, assertionId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('badge_credential_ciphertext', { p_assertion_id: assertionId });
  if (error || typeof data !== 'string') return null;
  return openCredential(data, badgeStorageKey());
}

/** Adresse de vérification inscrite dans le crédential (elle porte le jeton public). */
export function verificationUrlOf(jwt: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')) as { id?: unknown };
    return typeof payload.id === 'string' && payload.id.startsWith(`${badgeOrigin()}/badges/verifier/`) ? payload.id : null;
  } catch {
    return null;
  }
}

// ── Vérification publique ───────────────────────────────────────────────────

export type PublicBadge = {
  check: BadgeCheck['status'];
  issuer: string;
  badge: { name: string; description: string; criteria: string; imageUrl: string | null } | null;
  holder: { firstName: string; lastInitial: string } | null;
  issuedAt: string | null;
  revokedAt: string | null;
};

/** Durée minimale de toute réponse : un identifiant inconnu ne se distingue pas par le temps. */
const MIN_RESOLVE_MS = 300;

/**
 * Vérifie un badge à partir du jeton de son adresse. Null pour un identifiant inconnu ou mal
 * formé (message neutre). La base est lue avec la clé de service, filtrée sur l'empreinte du
 * jeton ; la sortie ne contient que ce qu'affiche la page (prénom et initiale du nom).
 */
export async function resolvePublicBadge(token: string): Promise<PublicBadge | null> {
  const started = Date.now();
  let result: PublicBadge | null = null;
  try {
    result = isShareTokenFormat(token) ? await resolve(token) : null;
  } catch {
    result = null;
  }
  const elapsed = Date.now() - started;
  if (elapsed < MIN_RESOLVE_MS) await new Promise((done) => setTimeout(done, MIN_RESOLVE_MS - elapsed));
  return result;
}

async function resolve(token: string): Promise<PublicBadge | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('badge_assertions')
    .select('issued_at, revoked_at, credential_sha256, credential_ciphertext, participants ( first_name, last_name ), badge_classes ( name, description, criteria_narrative, image_url )')
    .eq('public_id_hash', hashShareToken(token))
    .maybeSingle();
  if (!data) return null;
  const check = checkStoredBadge({
    jwt: openCredential(data.credential_ciphertext, badgeStorageKey()),
    storedSha256: data.credential_sha256,
    expectedId: badgeUrls.verify(token),
    revokedAt: data.revoked_at,
    keys: publicKeys(),
  });
  const trusted = check.status === 'valid' || check.status === 'revoked';
  // Le contenu affiché est celui du crédential signé ; à défaut (badge révoqué illisible), celui du modèle.
  const signed: OpenBadgeCredential | null = trusted ? check.credential : null;
  const achievement = signed?.credentialSubject.achievement;
  return {
    check: check.status,
    issuer: signed?.issuer.name ?? siteConfig.name,
    badge: trusted
      ? {
          name: achievement?.name ?? data.badge_classes?.name ?? 'Badge',
          description: achievement?.description ?? data.badge_classes?.description ?? '',
          criteria: achievement?.criteria.narrative ?? data.badge_classes?.criteria_narrative ?? '',
          imageUrl: achievement?.image?.id ?? absoluteImage(data.badge_classes?.image_url),
        }
      : null,
    holder: trusted && data.participants ? { firstName: data.participants.first_name, lastInitial: `${data.participants.last_name.charAt(0).toUpperCase()}.` } : null,
    issuedAt: trusted ? data.issued_at : null,
    revokedAt: check.status === 'revoked' ? check.revokedAt : null,
  };
}
