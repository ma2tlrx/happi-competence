/**
 * Ouverture des enquêtes de satisfaction — module pur.
 *
 * Reproduit, pour l'affichage, les règles de la base (private.group_programme_end et
 * private.satisfaction_is_open) : c'est la base qui autorise ou refuse une réponse.
 *   • Fin du programme : la dernière séance (hors annulées) est terminée, ou le groupe est
 *     marqué terminé. Date de fin : date prévue de cette séance, à défaut sa date de clôture,
 *     à défaut la date de fin du groupe.
 *   • À chaud : de la fin du programme jusqu'à l'ouverture de l'enquête à froid.
 *   • À froid : à partir de la fin + 90 jours.
 */

export type SatisfactionMoment = 'hot' | 'cold';
export type SatisfactionAudience = 'participant' | 'prescriber';

export const COLD_DELAY_DAYS = 90;

export const MOMENT_LABELS: Record<SatisfactionMoment, { label: string; short: string; description: string }> = {
  hot: { label: 'À chaud', short: 'à chaud', description: 'dès la fin du programme' },
  cold: { label: 'À froid', short: 'à froid', description: `${COLD_DELAY_DAYS} jours après la fin du programme` },
};

export const AUDIENCE_LABELS: Record<SatisfactionAudience, string> = {
  participant: 'Participants',
  prescriber: 'Prescripteurs',
};

export type WindowSession = {
  number: number;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled' | string;
  /** Date prévue (AAAA-MM-JJ). */
  date: string | null;
  /** Horodatage de clôture de la séance (ISO). */
  completedAt?: string | null;
};

export type WindowGroup = {
  status: string;
  endDate: string | null;
  /** Date de dernière mise à jour du groupe (ISO), dernier recours si le groupe est terminé sans date. */
  updatedAt?: string | null;
  sessions: WindowSession[];
};

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function todayInParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function parisDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : todayInParis(date);
}

/** Ajoute des jours à une date AAAA-MM-JJ (calcul en UTC : pas d'effet des changements d'heure). */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Date de fin du programme du groupe, ou null tant que le programme n'est pas terminé. */
export function programmeEnd(group: WindowGroup): string | null {
  const last = [...group.sessions].filter((session) => session.status !== 'cancelled').sort((a, b) => b.number - a.number)[0];
  if (last?.status === 'completed') return last.date ?? parisDate(last.completedAt) ?? group.endDate;
  if (group.status === 'completed') return group.endDate ?? last?.date ?? parisDate(group.updatedAt);
  return null;
}

export type SatisfactionWindow = {
  endDate: string | null;
  coldOpensOn: string | null;
  hotOpen: boolean;
  coldOpen: boolean;
};

export function satisfactionWindow(group: WindowGroup, today: string = todayInParis()): SatisfactionWindow {
  const endDate = programmeEnd(group);
  const coldOpensOn = endDate ? addDays(endDate, COLD_DELAY_DAYS) : null;
  return {
    endDate,
    coldOpensOn,
    hotOpen: coldOpensOn !== null && today < coldOpensOn,
    coldOpen: coldOpensOn !== null && today >= coldOpensOn,
  };
}
