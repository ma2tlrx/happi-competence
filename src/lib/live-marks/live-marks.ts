/**
 * Points en direct : logique pure (formatage du repère, regroupement, file hors ligne).
 * Ce sont des aide-mémoire du formateur : aucun score n'est produit ici.
 */

export type LiveMark = {
  id: string;
  participantId: string;
  /** Code stable de compétence ; nul = « général ». */
  skillCode: string | null;
  blockIndex: number | null;
  blockTitle: string | null;
  elapsedSeconds: number | null;
  createdAt: string;
};

/** Un « + » en attente d'envoi (file locale). `id` est généré côté client : un renvoi est donc idempotent. */
export type PendingMark = {
  id: string;
  participantId: string;
  skillCode: string | null;
  blockIndex: number | null;
  blockTitle: string | null;
  elapsedSeconds: number | null;
  clientAt: number;
};

/** « Léa D. » : prénom et initiale du nom, pour tenir sur un petit bouton. */
export function displayName(firstName: string, lastName: string) {
  const first = firstName.trim();
  const initial = Array.from(lastName.trim())[0];
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

/** Repère affiché après la séance : « pendant « Titre » (bloc 3), à 14 min ». */
export function formatMarkContext({ blockIndex, blockTitle, elapsedSeconds }: Pick<LiveMark, 'blockIndex' | 'blockTitle' | 'elapsedSeconds'>) {
  const parts: string[] = [];
  if (blockTitle) parts.push(`pendant « ${blockTitle} »${blockIndex !== null ? ` (bloc ${blockIndex + 1})` : ''}`);
  else if (blockIndex !== null) parts.push(`pendant le bloc ${blockIndex + 1}`);
  if (elapsedSeconds !== null) {
    const minutes = Math.floor(elapsedSeconds / 60);
    parts.push(minutes >= 60 ? `à ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}` : `à ${minutes} min`);
  }
  return parts.join(', ');
}

export type SkillMarks = { skillCode: string | null; marks: LiveMark[] };
export type ParticipantMarks = { total: number; bySkill: SkillMarks[] };

/** Regroupe par participant puis par compétence (« général » d'abord), du plus ancien au plus récent. */
export function groupMarksByParticipant(marks: LiveMark[]): Record<string, ParticipantMarks> {
  const result: Record<string, ParticipantMarks> = {};
  for (const mark of marks) {
    const entry = (result[mark.participantId] ??= { total: 0, bySkill: [] });
    entry.total += 1;
    let bucket = entry.bySkill.find((item) => item.skillCode === mark.skillCode);
    if (!bucket) {
      bucket = { skillCode: mark.skillCode, marks: [] };
      entry.bySkill.push(bucket);
    }
    bucket.marks.push(mark);
  }
  for (const entry of Object.values(result)) {
    for (const bucket of entry.bySkill) bucket.marks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    entry.bySkill.sort((a, b) => (a.skillCode === null ? -1 : b.skillCode === null ? 1 : a.skillCode.localeCompare(b.skillCode)));
  }
  return result;
}

export const enqueueMark = (queue: PendingMark[], item: PendingMark) => (queue.some((entry) => entry.id === item.id) ? queue : [...queue, item]);
export const removeFromQueue = (queue: PendingMark[], id: string) => queue.filter((entry) => entry.id !== id);

const isPending = (value: unknown): value is PendingMark => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.participantId === 'string' && typeof v.clientAt === 'number';
};

/** Relecture tolérante du stockage local : jamais d'exception, le contenu invalide est ignoré. */
export function parseQueue(raw: string | null): PendingMark[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPending) : [];
  } catch {
    return [];
  }
}

export type SendOutcome = 'sent' | 'retry' | 'rejected';

/**
 * Envoie la file dans l'ordre. Reste en file : tout ce qui est à réessayer (réseau, erreur serveur, exception).
 * Sort de la file : ce qui est envoyé, ou refusé définitivement (donnée invalide, droit retiré).
 */
export async function flushQueue(queue: PendingMark[], send: (item: PendingMark) => Promise<SendOutcome>): Promise<PendingMark[]> {
  const remaining: PendingMark[] = [];
  for (const item of queue) {
    let outcome: SendOutcome;
    try {
      outcome = await send(item);
    } catch {
      outcome = 'retry';
    }
    if (outcome === 'retry') remaining.push(item);
  }
  return remaining;
}
