/**
 * Règles d'affichage partagées par les listes (logique pure, testée) :
 * statut affiché d'un groupe, séances « à venir », filtres de la liste des participants
 * d'un organisme (page et export CSV doivent donner la même sélection).
 */
import { normalizeText } from './utils';

/**
 * Statut affiché d'un groupe : un groupe « en cours » dont la date de début n'est pas encore
 * atteinte s'affiche « prévu ». Les autres statuts sont affichés tels quels.
 */
export function displayGroupStatus(group: { status: string; startDate?: string | null }, today: string) {
  if (group.status === 'active' && group.startDate && group.startDate > today) return 'planned';
  return group.status;
}

/** Séance à venir : prévue (ni en cours, ni terminée, ni annulée), aujourd'hui ou plus tard, ou pas encore datée. */
export function isUpcomingSession(session: { status: string; date?: string | null }, today: string) {
  return session.status === 'planned' && (!session.date || session.date >= today);
}

export type OrgParticipantFilters = { q?: string | null; groupe?: string | null; programme?: string | null };
type Filterable = { firstName: string; lastName: string; email: string | null; groupId: string | null; programName: string | null };

/** Filtres de la liste des participants d'un organisme (recherche, groupe, programme). */
export function filterOrgParticipants<T extends Filterable>(rows: T[], filters: OrgParticipantFilters): T[] {
  const query = normalizeText(filters.q ?? '');
  return rows.filter(
    (row) =>
      (!query || normalizeText(`${row.firstName} ${row.lastName} ${row.email ?? ''}`).includes(query)) &&
      (!filters.groupe || row.groupId === filters.groupe) &&
      (!filters.programme || row.programName === filters.programme),
  );
}

/** Paramètres d'adresse des filtres actifs (pour un lien d'export qui reprend la sélection). */
export function orgParticipantFilterQuery(filters: OrgParticipantFilters) {
  const params = new URLSearchParams();
  for (const key of ['q', 'groupe', 'programme'] as const) {
    const value = filters[key]?.trim();
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}
