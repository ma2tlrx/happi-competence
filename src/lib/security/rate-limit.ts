import 'server-only';

import { headers } from 'next/headers';

import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';

import {
  clientIp,
  evaluateRateLimits,
  rateLimitMessage,
  type RateLimitHit,
  type RateLimitScope,
  type RateLimitSubject,
} from './rate-limit-core';

/** Clé des empreintes : variable dédiée si elle existe, sinon la clé de service (jamais exposée au navigateur). */
function fingerprintSecret() {
  return process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? '';
}

/** Adresse IP de la requête en cours (voir l'hypothèse de confiance dans clientIp). */
export async function requestIp() {
  return clientIp(await headers());
}

const hitWithServiceRole: RateLimitHit = async (action, keyHash, rule) => {
  const { data, error } = await createAdminClient().rpc('rate_limit_hit', {
    p_action: action,
    p_key_hash: keyHash,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    console.error('Limitation de débit indisponible', error?.message ?? 'réponse inattendue');
    return null;
  }
  const result = data as { allowed?: boolean; retry_after?: number };
  return { allowed: result.allowed !== false, retryAfterSeconds: Number(result.retry_after ?? 0) };
};

/**
 * Compte une tentative (par IP, e-mail ou compte) et renvoie un message d'erreur en
 * français si la limite est atteinte, sinon `null`. À appeler côté serveur, avant
 * l'opération protégée. Sans clé de service, aucune limite applicative n'est appliquée.
 */
export async function rateLimit(scope: RateLimitScope, subjects: Partial<Record<RateLimitSubject, string | null | undefined>>) {
  if (!isAdminClientConfigured()) return null;
  const verdict = await evaluateRateLimits(scope, subjects, fingerprintSecret(), hitWithServiceRole);
  return verdict.ok ? null : rateLimitMessage(scope, verdict.retryAfterSeconds);
}
