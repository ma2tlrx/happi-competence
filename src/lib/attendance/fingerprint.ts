import { createHash } from 'node:crypto';

/**
 * Empreintes SHA-256 de l'émargement.
 * - signatureSha256 reproduit exactement private.signature_sha256 (base) pour vérifier
 *   qu'une signature n'a pas été altérée ;
 * - sheetFingerprint scelle l'ensemble des données imprimées sur une feuille.
 */
export function sha256Hex(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export type SignatureHashInput = {
  sessionId: string;
  /** Nul pour la contre-signature du formateur. */
  participantId: string | null;
  /** Horodatage renvoyé par la base (tronqué à la milliseconde). */
  signedAt: string;
  kind: 'drawn' | 'unable' | 'countersign';
  /** Tracé (drawn), motif (unable) ou « tracé|empreinte des signatures » (countersign). */
  content: string;
};

export function signatureSha256({ sessionId, participantId, signedAt, kind, content }: SignatureHashInput) {
  const instant = new Date(signedAt);
  if (Number.isNaN(instant.getTime())) throw new Error('Horodatage invalide.');
  return sha256Hex(['happi-emargement-v1', sessionId, participantId ?? 'formateur', instant.toISOString(), kind, content].join('|'));
}

/** JSON canonique : clés triées à tous les niveaux, sans espace ; les valeurs indéfinies sont omises. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}

/** Empreinte des données d'une feuille (indépendante de la date de génération du PDF). */
export function sheetFingerprint(data: unknown) {
  return sha256Hex(canonicalJson(data));
}
