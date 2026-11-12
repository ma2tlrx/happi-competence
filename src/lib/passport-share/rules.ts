import { z } from 'zod';

import '@/lib/zod-fr';

/** Règles des liens de partage, identiques à celles que la base applique (create_passport_share). */
export const SHARE_DURATIONS = [7, 30, 90] as const;
export type ShareDuration = (typeof SHARE_DURATIONS)[number];
export const MAX_ACTIVE_SHARES = 10;
export const SHARE_LABEL_MAX = 80;

export type ShareStatus = 'active' | 'expired' | 'revoked';

export const SHARE_STATUS_LABELS: Record<ShareStatus, string> = {
  active: 'Actif',
  expired: 'Expiré',
  revoked: 'Révoqué',
};

/** Un lien révoqué le reste, même après sa date d'expiration. */
export function shareStatus(share: { revokedAt: string | null; expiresAt: string }, now: Date = new Date()): ShareStatus {
  if (share.revokedAt) return 'revoked';
  return new Date(share.expiresAt).getTime() > now.getTime() ? 'active' : 'expired';
}

export function countActive(shares: { revokedAt: string | null; expiresAt: string }[], now: Date = new Date()) {
  return shares.filter((share) => shareStatus(share, now) === 'active').length;
}

/** Case à cocher : cochée si « on » (ou « true ») ; absente, vide ou autre valeur = non cochée. */
const checkbox = z.unknown().optional().transform((value) => value === 'on' || value === 'true');

export const shareFormSchema = z.object({
  label: z
    .string()
    .transform((value) => value.replace(/[\p{Cc}]+/gu, ' ').trim())
    .pipe(z.string().min(1, 'Indiquez pour qui est ce lien (par exemple « Entreprise Dupont »).').max(SHARE_LABEL_MAX, `${SHARE_LABEL_MAX} caractères au plus.`)),
  duration: z.coerce
    .number()
    .refine((value): value is ShareDuration => (SHARE_DURATIONS as readonly number[]).includes(value), 'Choisissez une durée de 7, 30 ou 90 jours.'),
  includeSociocognitive: checkbox,
  includeReport: checkbox,
});
export type ShareForm = z.infer<typeof shareFormSchema>;
