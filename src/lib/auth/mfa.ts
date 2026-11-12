/**
 * Double authentification (TOTP, Supabase Auth MFA) : règles pures, utilisables dans
 * le proxy, les composants serveur et les tests.
 *
 * Niveaux d'assurance (Supabase) : « aal1 » après le mot de passe, « aal2 » après la
 * saisie d'un code à usage unique. La base applique les mêmes règles
 * (private.mfa_satisfied) : sans le bon niveau, le rôle du compte n'est pas reconnu.
 */

export type AssuranceLevel = 'aal1' | 'aal2';

export type MfaState = {
  /** Niveau de la session courante. */
  aal: AssuranceLevel;
  /** Le compte a au moins un facteur vérifié. */
  enrolled: boolean;
  /** La politique de la plateforme impose un facteur à ce compte (administrateurs et formateurs). */
  required: boolean;
};

/** Page de saisie du code après connexion. */
export const MFA_CHALLENGE_PATH = '/double-authentification';
/** Page d'activation, dans « Mon compte ». */
export const MFA_SETUP_PATH = '/compte/securite';

/**
 * Étape de double authentification à franchir avant d'accéder à l'espace :
 * - « challenge » : un facteur est vérifié mais la session n'est qu'en aal1 ;
 * - « enroll » : la plateforme l'exige pour ce rôle et aucun facteur n'est actif ;
 * - `null` : rien à faire.
 */
export function mfaStep(state: MfaState): 'challenge' | 'enroll' | null {
  if (state.enrolled && state.aal !== 'aal2') return 'challenge';
  if (state.required && !state.enrolled) return 'enroll';
  return null;
}

export function parseAssuranceLevel(value: unknown): AssuranceLevel {
  return value === 'aal2' ? 'aal2' : 'aal1';
}

/** Lecture de la réponse de public.my_mfa_status (valeurs prudentes si elle est absente). */
export function parseMfaStatus(value: unknown, fallbackAal: AssuranceLevel): MfaState {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    aal: 'aal' in record ? parseAssuranceLevel(record.aal) : fallbackAal,
    enrolled: record.verified === true,
    required: record.required === true,
  };
}

/**
 * Charge utile d'un jeton JWT, sans vérification de signature. À n'utiliser que sur un
 * jeton déjà validé par ailleurs (le proxy l'a fait valider par getUser()).
 */
export function decodeJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  const part = token?.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)));
    const payload = JSON.parse(json) as unknown;
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Un code TOTP : six chiffres (les espaces saisis par confort sont retirés). */
export function normalizeTotpCode(value: unknown) {
  const code = String(value ?? '').replace(/[\s-]/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}

/**
 * Image du QR code fournie par Supabase (SVG, éventuellement déjà préfixé par
 * `data:image/svg+xml;utf-8,`), réencodée en URI de données sûre pour un attribut src.
 */
export function qrCodeDataUri(qrCode: string) {
  const svg = qrCode.replace(/^data:image\/svg\+xml;(?:utf-8|charset=utf-8),/i, '');
  if (!svg.trimStart().startsWith('<svg') && !svg.trimStart().startsWith('<?xml')) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
