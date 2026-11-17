/**
 * Compatibilité entre une personne en attente et un groupe : programme, créneaux des séances
 * à venir et date de démarrage souhaitée. Sert à proposer les personnes en liste d'attente
 * sur la page d'un groupe (calcul indicatif : l'équipe HAPPI décide).
 */
import type { Day, Slot } from './fields';

const WEEKDAYS: (Day | null)[] = [null, 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export type GroupSlotSession = { date: string | null; startTime: string | null; status?: string | null };
export type CandidateAvailability = {
  programId: string | null;
  availabilityDays: readonly string[];
  availabilitySlots: readonly string[];
  desiredStartDate: string | null;
};
export type GroupForMatch = { programId: string; startDate: string | null; endDate: string | null; sessions: GroupSlotSession[] };

/** Jour de la semaine (heure locale de la date AAAA-MM-JJ, sans fuseau). */
export function dayOf(date: string): Day | null {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? null;
}

/** Matin avant 12 h 00, après-midi ensuite. */
export function slotOf(time: string | null): Slot | null {
  if (!time) return null;
  const hours = Number(time.split(':')[0]);
  if (!Number.isFinite(hours)) return null;
  return hours < 12 ? 'matin' : 'apres_midi';
}

/** Créneaux (jour, demi-journée) des séances à venir ou non datées du groupe. */
export function groupSlots(sessions: GroupSlotSession[], today: string) {
  const days = new Set<Day>();
  const slots = new Set<Slot>();
  for (const session of sessions) {
    if (session.status === 'completed' || session.status === 'cancelled') continue;
    if (!session.date || session.date < today) continue;
    const day = dayOf(session.date);
    const slot = slotOf(session.startTime);
    if (day) days.add(day);
    if (slot) slots.add(slot);
  }
  return { days: [...days], slots: [...slots] };
}

export type Compatibility = {
  compatible: boolean;
  /** 0 à 3 : programme, créneaux, date. Sert au tri. */
  score: number;
  reasons: string[];
};

export function compatibility(candidate: CandidateAvailability, group: GroupForMatch, today: string): Compatibility {
  const reasons: string[] = [];
  let score = 0;
  let compatible = true;

  if (candidate.programId && candidate.programId !== group.programId) {
    compatible = false;
    reasons.push('Autre programme souhaité');
  } else {
    score += 1;
    if (!candidate.programId) reasons.push('Programme non précisé');
  }

  const { days, slots } = groupSlots(group.sessions, today);
  const knownAvailability = candidate.availabilityDays.length > 0 || candidate.availabilitySlots.length > 0;
  if (days.length === 0 && slots.length === 0) {
    reasons.push('Séances pas encore datées');
  } else if (!knownAvailability) {
    reasons.push('Disponibilités non renseignées');
  } else {
    const missingDays = candidate.availabilityDays.length ? days.filter((day) => !candidate.availabilityDays.includes(day)) : [];
    const missingSlots = candidate.availabilitySlots.length ? slots.filter((slot) => !candidate.availabilitySlots.includes(slot)) : [];
    if (missingDays.length || missingSlots.length) {
      compatible = false;
      reasons.push('Créneaux du groupe hors disponibilités');
    } else {
      score += 1;
      reasons.push('Disponibilités compatibles');
    }
  }

  if (candidate.desiredStartDate && group.endDate && candidate.desiredStartDate > group.endDate) {
    compatible = false;
    reasons.push('Démarrage souhaité après la fin du groupe');
  } else if (candidate.desiredStartDate && group.startDate && candidate.desiredStartDate > group.startDate && group.startDate < today) {
    score += 0.5;
    reasons.push('Groupe déjà commencé');
  } else {
    score += 1;
  }

  return { compatible, score, reasons };
}

/** Personnes en attente compatibles, les plus anciennes orientations d'abord à score égal. */
export function rankCandidates<T extends CandidateAvailability & { createdAt: string }>(candidates: T[], group: GroupForMatch, today: string) {
  return candidates
    .map((candidate) => ({ candidate, match: compatibility(candidate, group, today) }))
    .filter((entry) => entry.match.compatible)
    .sort((a, b) => b.match.score - a.match.score || a.candidate.createdAt.localeCompare(b.candidate.createdAt));
}

/** Places restantes : capacité du groupe bornée par la taille maximale du programme. */
export function freeSeats(capacity: number | null, maxGroupSize: number, activeMembers: number) {
  return Math.max(0, Math.min(capacity ?? maxGroupSize, maxGroupSize) - activeMembers);
}
