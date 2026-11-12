/**
 * Alerte de décrochage — calcul pur, sans accès à la base (rien n'est stocké).
 *
 * Règles (provisoires, à valider avec l'équipe pédagogique) :
 *   • « absences consécutives » : les deux dernières présences renseignées d'un participant
 *     actif, sur les séances terminées de son groupe, sont « absent » ou « excusé » ;
 *   • « absence non justifiée » : le participant est « absent » (sans motif, donc pas « excusé »)
 *     à la dernière séance terminée du groupe.
 * Une séance terminée sans présence saisie pour le participant est ignorée : elle ne compte ni
 * comme une absence ni comme une présence (une donnée manquante n'est jamais une absence).
 */

export type DropoutSession = { id: string; status: string; date: string | null; number: number };
export type DropoutAttendance = { sessionId: string; participantId: string; status: string };
export type DropoutReason = 'consecutive_absences' | 'unexcused_last_session';

export type DropoutAlert = {
  participantId: string;
  reasons: DropoutReason[];
  /** Nombre d'absences (absent ou excusé) consécutives à la fin des séances renseignées. */
  trailingAbsences: number;
  /** Dernière séance terminée renseignée pour ce participant. */
  lastSessionId: string | null;
};

export const DROPOUT_REASON_LABELS: Record<DropoutReason, string> = {
  consecutive_absences: 'Absences consécutives',
  unexcused_last_session: 'Absent sans motif à la dernière séance',
};

const ABSENCES = new Set(['absent', 'excused']);
export const CONSECUTIVE_THRESHOLD = 2;

function chronological(sessions: DropoutSession[]) {
  return [...sessions].sort((a, b) => (a.date ?? '9999-12-31').localeCompare(b.date ?? '9999-12-31') || a.number - b.number);
}

/** Alertes des participants actifs d'un groupe, dans l'ordre des participants fournis. */
export function dropoutAlerts(activeParticipantIds: string[], sessions: DropoutSession[], attendance: DropoutAttendance[]): DropoutAlert[] {
  const completed = chronological(sessions.filter((session) => session.status === 'completed'));
  if (completed.length === 0) return [];
  const lastCompleted = completed[completed.length - 1]!;
  const byKey = new Map(attendance.map((row) => [`${row.participantId}:${row.sessionId}`, row.status]));
  const alerts: DropoutAlert[] = [];
  for (const participantId of activeParticipantIds) {
    const recorded = completed
      .map((session) => ({ session, status: byKey.get(`${participantId}:${session.id}`) }))
      .filter((entry): entry is { session: DropoutSession; status: string } => entry.status !== undefined);
    let trailing = 0;
    for (let index = recorded.length - 1; index >= 0 && ABSENCES.has(recorded[index]!.status); index -= 1) trailing += 1;
    const reasons: DropoutReason[] = [];
    if (trailing >= CONSECUTIVE_THRESHOLD) reasons.push('consecutive_absences');
    if (byKey.get(`${participantId}:${lastCompleted.id}`) === 'absent') reasons.push('unexcused_last_session');
    if (reasons.length) {
      alerts.push({ participantId, reasons, trailingAbsences: trailing, lastSessionId: recorded[recorded.length - 1]?.session.id ?? null });
    }
  }
  return alerts;
}
