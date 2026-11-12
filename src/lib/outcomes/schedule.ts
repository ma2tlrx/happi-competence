/**
 * Échéancier des suivis — calcul pur.
 *
 * Point de départ d'un parcours (« date de référence ») :
 *   • abandon : la date d'abandon ;
 *   • groupe terminé (statut terminé ou archivé, ou date de fin dépassée) : la date de fin du groupe,
 *     à défaut la date de la dernière séance terminée.
 * À partir de cette date : la situation de sortie est attendue tout de suite, puis les suivis à
 * 3 et 6 mois. Un participant retiré (erreur d'inscription) n'a pas de suivi.
 */
import type { OutcomeKind } from './labels';

export type ScheduleGroup = {
  id: string;
  name: string;
  status: string;
  endDate: string | null;
  /** Date de la dernière séance terminée, utilisée si la date de fin n'est pas renseignée. */
  lastCompletedSessionDate?: string | null;
};
export type ScheduleMembership = { groupId: string; participantId: string; status: string; droppedAt: string | null };
export type ScheduleOutcome = { participantId: string; groupId: string | null; kind: string };

export type FollowupKind = Extract<OutcomeKind, 'exit' | 'followup_3m' | 'followup_6m'>;
export type FollowupState = 'done' | 'late' | 'due' | 'upcoming';
export type FollowupTask = {
  participantId: string;
  groupId: string;
  groupName: string;
  kind: FollowupKind;
  /** Date à partir de laquelle la saisie est attendue ; nulle si la date de fin est inconnue. */
  dueDate: string | null;
  referenceDate: string | null;
  dropped: boolean;
  state: FollowupState;
};

export const FOLLOWUP_STATE_LABELS: Record<FollowupState, string> = {
  done: 'Renseigné',
  late: 'En retard',
  due: 'À faire',
  upcoming: 'À venir',
};

/** Au-delà de ce délai après l'échéance, un suivi non renseigné passe « en retard ». */
export const LATE_AFTER_DAYS = 30;
const OFFSETS: Record<FollowupKind, number> = { exit: 0, followup_3m: 3, followup_6m: 6 };

/** Ajoute des mois à une date ISO (AAAA-MM-JJ), en restant dans le mois visé (31 août + 6 mois = 28/29 février). */
export function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

export function isGroupFinished(group: Pick<ScheduleGroup, 'status' | 'endDate'>, today: string) {
  return group.status === 'completed' || group.status === 'archived' || (group.endDate !== null && group.endDate < today);
}

/**
 * Date de référence d'une inscription, ou `undefined` si le parcours n'est pas terminé
 * (aucun suivi attendu). `null` : parcours terminé mais sans date connue.
 */
export function referenceDate(membership: ScheduleMembership, group: ScheduleGroup, today: string): string | null | undefined {
  if (membership.status === 'dropped') return membership.droppedAt;
  if (membership.status !== 'active' || !isGroupFinished(group, today)) return undefined;
  return group.endDate ?? group.lastCompletedSessionDate ?? null;
}

export function stateFor(dueDate: string | null, done: boolean, today: string): FollowupState {
  if (done) return 'done';
  if (dueDate === null) return 'due';
  if (dueDate > today) return 'upcoming';
  return daysBetween(dueDate, today) > LATE_AFTER_DAYS ? 'late' : 'due';
}

/** Vrai si la saisie est attendue à la date du jour (échéance atteinte). */
export function isExpected(task: Pick<FollowupTask, 'state'>) {
  return task.state !== 'upcoming';
}

export function followupTasks(
  memberships: ScheduleMembership[],
  groups: ScheduleGroup[],
  outcomes: ScheduleOutcome[],
  today: string,
): FollowupTask[] {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const recorded = new Set(outcomes.map((outcome) => `${outcome.participantId}:${outcome.groupId ?? ''}:${outcome.kind}`));
  const tasks: FollowupTask[] = [];
  for (const membership of memberships) {
    const group = groupById.get(membership.groupId);
    if (!group) continue;
    const reference = referenceDate(membership, group, today);
    if (reference === undefined) continue;
    for (const kind of Object.keys(OFFSETS) as FollowupKind[]) {
      // Sans date de référence, seuls les suivis datés sont impossibles à placer : la sortie reste attendue.
      if (reference === null && kind !== 'exit') continue;
      const dueDate = reference === null ? null : addMonths(reference, OFFSETS[kind]);
      const done = recorded.has(`${membership.participantId}:${membership.groupId}:${kind}`);
      tasks.push({
        participantId: membership.participantId,
        groupId: membership.groupId,
        groupName: group.name,
        kind,
        dueDate,
        referenceDate: reference,
        dropped: membership.status === 'dropped',
        state: stateFor(dueDate, done, today),
      });
    }
  }
  const order: Record<FollowupState, number> = { late: 0, due: 1, upcoming: 2, done: 3 };
  return tasks.sort((a, b) => order[a.state] - order[b.state] || (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
}
