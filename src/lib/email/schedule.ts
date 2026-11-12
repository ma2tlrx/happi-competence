/**
 * Règles de calendrier et de reprise de la file d'e-mails (fonctions pures, testées).
 * Les séances sont saisies en heure de Paris : `scheduled_date` est une date locale.
 */

export const PARIS_TIME_ZONE = 'Europe/Paris';

/** Plafond de tentatives d'envoi d'un message (repris dans la migration email_outbox). */
export const MAX_ATTEMPTS = 5;

/** Taille d'un lot traité en une passe. */
export const BATCH_SIZE = 25;

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function parisDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Ajoute des jours calendaires à une date AAAA-MM-JJ (sans fuseau : pas d'effet du changement d'heure). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year!, month! - 1, day! + days));
  return value.toISOString().slice(0, 10);
}

/** Date du lendemain à Paris : les séances qui recevront le rappel J-1. */
export function tomorrowInParis(now: Date = new Date()): string {
  return addDays(parisDate(now), 1);
}

/** Délai avant la tentative suivante : 5 min, 10 min, 20 min, 40 min… plafonné à 6 h. */
export function retryDelayMs(attempts: number): number {
  const minutes = 5 * 2 ** Math.max(0, attempts - 1);
  return Math.min(minutes, 6 * 60) * 60_000;
}

/** Une séance est-elle encore à venir (date du jour à Paris comprise) ? */
export function isUpcoming(scheduledDate: string | null | undefined, now: Date = new Date()): boolean {
  return Boolean(scheduledDate) && scheduledDate! >= parisDate(now);
}

// ── Clés d'idempotence ──────────────────────────────────────────────────────
export type SessionSnapshot = {
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  status: string;
};

/** Empreinte courte et stable de l'état d'une séance (date, horaires, lieu). */
export function sessionFingerprint(session: SessionSnapshot): string {
  const value = [session.scheduled_date ?? '', (session.start_time ?? '').slice(0, 5), (session.end_time ?? '').slice(0, 5), session.location ?? ''].join('|');
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export const idempotencyKeys = {
  convocation: (sessionId: string, participantId: string) => `convocation:${sessionId}:${participantId}`,
  /** Une modification n'est annoncée qu'une fois par nouvel état de la séance. */
  update: (sessionId: string, participantId: string, session: SessionSnapshot) => `session_update:${sessionId}:${participantId}:${sessionFingerprint(session)}`,
  cancellation: (sessionId: string, participantId: string) => `session_cancel:${sessionId}:${participantId}`,
  /** Le rappel dépend de la date : une séance reportée donne lieu à un nouveau rappel. */
  reminder: (sessionId: string, participantId: string, date: string) => `reminder:${sessionId}:${participantId}:${date}`,
  report: (reportId: string) => `report_available:${reportId}`,
  invitation: (participantId: string) => `invitation:${participantId}`,
  test: (userId: string, now: Date = new Date()) => `test:${userId}:${now.getTime()}`,
};

/** Changement à annoncer aux participants après la modification d'une séance. */
export function sessionChangeKind(before: SessionSnapshot, after: SessionSnapshot): 'cancelled' | 'updated' | null {
  if (after.status === 'cancelled') return before.status === 'cancelled' ? null : 'cancelled';
  if (after.status !== 'planned') return null;
  if (before.status === 'cancelled') return 'updated';
  return sessionFingerprint(before) === sessionFingerprint(after) ? null : 'updated';
}
