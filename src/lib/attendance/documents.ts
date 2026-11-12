import type { Realisation } from './hours';

/** Données des documents d'émargement (feuille par séance, certificat de réalisation). */

/** Organisme de formation émetteur des documents. Coordonnées légales : à compléter (à valider). */
export const TRAINING_ORGANISATION = {
  name: 'HAPPI Compétence',
  legal: 'SIRET et numéro de déclaration d’activité : à compléter',
};

export type SheetRow = {
  participantId: string;
  lastName: string;
  firstName: string;
  status: string | null;
  statusLabel: string;
  /** Statut modifié après la contre-signature (correction tracée par un administrateur). */
  corrected: boolean;
  signature: {
    kind: 'drawn' | 'unable';
    path: string | null;
    reason: string | null;
    signedAt: string;
    method: string;
    sha256: string;
    /** L'empreinte recalculée correspond à l'empreinte enregistrée. */
    verified: boolean;
  } | null;
};

export type SignatureSheet = {
  session: {
    id: string;
    number: number;
    title: string;
    date: string | null;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
    status: string;
  };
  groupId: string;
  groupName: string;
  organizationName: string | null;
  programName: string;
  trainers: string[];
  rows: SheetRow[];
  countersignature: { trainerName: string; signedAt: string; path: string; sha256: string; signaturesSha256: string; verified: boolean } | null;
  fingerprint: string;
};

export type Certificate = {
  participant: { id: string; firstName: string; lastName: string; organizationName: string | null };
  group: { id: string; name: string; startDate: string | null; endDate: string | null; organizationName: string | null };
  programName: string;
  modality: string;
  realisation: Realisation;
  fingerprint: string;
};

