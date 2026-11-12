import { createHmac } from 'node:crypto';

/**
 * Limitation de débit : logique pure (règles, empreintes, adresse IP, messages).
 * Les compteurs sont tenus en base (public.rate_limit_hit, réservée à la clé de service) ;
 * voir rate-limit.ts pour l'appel serveur.
 */

export type RateLimitRule = {
  /** Nombre de tentatives autorisées par fenêtre. */
  limit: number;
  /** Durée de la fenêtre, en secondes (fenêtre fixe). */
  windowSeconds: number;
};

/**
 * Seuils par action et par sujet (IP, e-mail, compte). Ils restent larges pour un usage
 * normal (plusieurs personnes d'une même structure derrière une seule adresse IP) et
 * bloquent les essais en série. Supabase Auth applique en plus ses propres limites.
 */
export const RATE_LIMITS = {
  'login.ip': { limit: 30, windowSeconds: 15 * 60 },
  'login.email': { limit: 8, windowSeconds: 15 * 60 },
  'signup.ip': { limit: 10, windowSeconds: 60 * 60 },
  'password_reset.ip': { limit: 10, windowSeconds: 60 * 60 },
  'password_reset.email': { limit: 3, windowSeconds: 60 * 60 },
  'contact.ip': { limit: 5, windowSeconds: 60 * 60 },
  'access_code.ip': { limit: 10, windowSeconds: 60 * 60 },
  'access_code.user': { limit: 10, windowSeconds: 60 * 60 },
  'mfa.user': { limit: 10, windowSeconds: 15 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitAction = keyof typeof RATE_LIMITS;
export type RateLimitScope = 'login' | 'signup' | 'password_reset' | 'contact' | 'access_code' | 'mfa';
export type RateLimitSubject = 'ip' | 'email' | 'user';

const SCOPE_MESSAGES: Record<RateLimitScope, string> = {
  login: 'Trop de tentatives de connexion. Pour protéger les comptes, patientez {delai} avant de réessayer.',
  signup: 'Trop de créations de compte depuis cette connexion. Patientez {delai} avant de réessayer.',
  password_reset: 'Trop de demandes de réinitialisation. Patientez {delai} avant de réessayer.',
  contact: 'Vous avez envoyé plusieurs messages récemment. Patientez {delai} avant de réessayer.',
  access_code: 'Trop de codes saisis. Pour protéger les accès, patientez {delai} avant de réessayer.',
  mfa: 'Trop de codes de vérification saisis. Patientez {delai} avant de réessayer.',
};

/** Délai lisible, arrondi à la minute supérieure (« 1 minute », « 15 minutes », « 1 heure »). */
export function formatDelay(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? '1 heure' : `${hours} heures`;
}

/**
 * Message affiché quand la limite est atteinte. Il ne dépend que de l'action, jamais de
 * l'existence d'un compte : il ne révèle pas si une adresse est inscrite.
 */
export function rateLimitMessage(scope: RateLimitScope, retryAfterSeconds: number) {
  return SCOPE_MESSAGES[scope].replace('{delai}', formatDelay(retryAfterSeconds));
}

/** Normalisation de la valeur avant empreinte : une même adresse écrite autrement compte pour une. */
export function normalizeSubject(subject: RateLimitSubject, value: string) {
  const trimmed = value.trim();
  return subject === 'email' ? trimmed.toLowerCase() : trimmed;
}

/**
 * Empreinte HMAC-SHA256 (clé secrète serveur) : la base ne voit jamais l'adresse IP ni
 * l'e-mail, et sans la clé l'empreinte ne permet pas de les retrouver par essai exhaustif.
 */
export function subjectFingerprint(secret: string, subject: RateLimitSubject, value: string) {
  return createHmac('sha256', `happi-rate-limit:${secret}`).update(`${subject}:${normalizeSubject(subject, value)}`).digest('hex');
}

type HeaderReader = { get(name: string): string | null };

/**
 * Adresse IP du visiteur.
 *
 * Hypothèse de confiance : l'application est servie par Vercel, qui renseigne lui-même
 * `x-forwarded-for` (adresse du client en première position) et `x-real-ip`, et ne laisse
 * pas un visiteur imposer ces valeurs. Derrière un autre hébergeur ou un mandataire
 * (proxy, CDN), il faut vérifier que ces en-têtes sont réécrits par l'infrastructure : à
 * défaut, un visiteur pourrait changer d'« adresse » à chaque requête et contourner la
 * limite par IP (la limite par e-mail ou par compte reste alors efficace).
 */
export function clientIp(headers: HeaderReader) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const real = headers.get('x-real-ip')?.trim();
  const candidate = forwarded || real || '';
  // Valeur raisonnable uniquement (IPv4, IPv6) ; sinon un seau commun « inconnue ».
  return /^[0-9a-fA-F:.]{2,45}$/.test(candidate) ? candidate : 'inconnue';
}

export type RateLimitVerdict = { ok: true } | { ok: false; retryAfterSeconds: number; action: RateLimitAction };

export type RateLimitHit = (
  action: RateLimitAction,
  keyHash: string,
  rule: RateLimitRule,
) => Promise<{ allowed: boolean; retryAfterSeconds: number } | null>;

/**
 * Compte une tentative pour chaque sujet fourni et renvoie le premier refus (le délai le
 * plus long l'emporte). Un compteur indisponible (`null`) n'empêche pas l'action : la
 * disponibilité du service prime, Supabase Auth gardant ses propres limites.
 */
export async function evaluateRateLimits(
  scope: RateLimitScope,
  subjects: Partial<Record<RateLimitSubject, string | null | undefined>>,
  secret: string,
  hit: RateLimitHit,
): Promise<RateLimitVerdict> {
  const checks: { action: RateLimitAction; keyHash: string }[] = [];
  for (const subject of ['ip', 'email', 'user'] as const) {
    const value = subjects[subject];
    const action = `${scope}.${subject}` as RateLimitAction;
    if (!value || !(action in RATE_LIMITS)) continue;
    checks.push({ action, keyHash: subjectFingerprint(secret, subject, value) });
  }
  const results = await Promise.all(checks.map(async (check) => ({ check, result: await hit(check.action, check.keyHash, RATE_LIMITS[check.action]) })));
  let refusal: RateLimitVerdict = { ok: true };
  for (const { check, result } of results) {
    if (!result || result.allowed) continue;
    if (refusal.ok || result.retryAfterSeconds > refusal.retryAfterSeconds) {
      refusal = { ok: false, retryAfterSeconds: result.retryAfterSeconds, action: check.action };
    }
  }
  return refusal;
}
