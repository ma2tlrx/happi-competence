/**
 * Espace organisme « Mes groupes » : règles d'affichage (logique pure, testée).
 *
 * - Présence en cases : une case par séance terminée (présent ; retard ou départ anticipé ; absent ;
 *   absence justifiée ; non saisi). Une présence non saisie n'est jamais comptée comme une absence.
 * - Relance : une personne inscrite (statut actif) dont la dernière séance terminée renseignée est
 *   une absence sans justificatif peut être relancée, une seule fois pour cette absence. La même règle
 *   est vérifiée par la base (public.relaunch_absent_participant) : l'interface n'est qu'un reflet.
 * - Groupes : en cours, à venir, terminés (repliés), chacun dans un ordre utile.
 */
import { format, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

import { displayGroupStatus, isUpcomingSession } from '@/lib/listing-rules';

export type OrgSession = { id: string; number: number; status: string; date: string | null };

// ── Cases de présence ───────────────────────────────────────────────────────
export type PresenceCell = 'present' | 'partial' | 'absent' | 'excused' | 'unknown';

export const PRESENCE_LEGEND: readonly { cell: PresenceCell; label: string }[] = [
  { cell: 'present', label: 'Présent' },
  { cell: 'partial', label: 'Retard ou départ anticipé' },
  { cell: 'absent', label: 'Absent' },
  { cell: 'excused', label: 'Absence justifiée' },
  { cell: 'unknown', label: 'Non saisi' },
];

export const PRESENCE_LABELS = Object.fromEntries(PRESENCE_LEGEND.map((item) => [item.cell, item.label])) as Record<PresenceCell, string>;

const CELL_BY_STATUS = new Map<string, PresenceCell>([
  ['present', 'present'],
  ['late', 'partial'],
  ['left_early', 'partial'],
  ['absent', 'absent'],
  ['excused', 'excused'],
]);

export function presenceCell(status: string | null | undefined): PresenceCell {
  return (status ? CELL_BY_STATUS.get(status) : undefined) ?? 'unknown';
}

/** Ordre chronologique : date (une séance sans date en dernier), puis numéro. Même règle que les alertes de décrochage. */
export function chronological<T extends Pick<OrgSession, 'number' | 'date'>>(sessions: readonly T[]): T[] {
  return [...sessions].sort((a, b) => (a.date ?? '9999-12-31').localeCompare(b.date ?? '9999-12-31') || a.number - b.number);
}

export type PresenceEntry = { sessionId: string; number: number; date: string | null; cell: PresenceCell };

/** Une case par séance terminée du groupe, dans l'ordre chronologique. */
export function presenceTrail(sessions: readonly OrgSession[], statusBySession: ReadonlyMap<string, string>): PresenceEntry[] {
  return chronological(sessions.filter((item) => item.status === 'completed')).map((item) => ({
    sessionId: item.id,
    number: item.number,
    date: item.date,
    cell: presenceCell(statusBySession.get(item.id)),
  }));
}

// ── Relance ─────────────────────────────────────────────────────────────────
export type FollowupState =
  | { kind: 'none' }
  | { kind: 'dropped' }
  | { kind: 'to_relaunch'; sessionId: string; sessionNumber: number }
  | { kind: 'relaunched'; sessionId: string; sessionNumber: number; at: string };

const NONE: FollowupState = { kind: 'none' };

/**
 * État de relance d'un membre. `statusBySession` : présences saisies de la personne (séance → statut) ;
 * `followups` : relances déjà faites (séance → date). Seule la dernière séance terminée renseignée compte :
 * une personne revenue depuis n'est plus relancée, une nouvelle absence ouvre une nouvelle relance.
 */
export function followupState(input: {
  membership: string;
  sessions: readonly OrgSession[];
  statusBySession: ReadonlyMap<string, string>;
  followups: ReadonlyMap<string, string>;
}): FollowupState {
  if (input.membership === 'dropped') return { kind: 'dropped' };
  if (input.membership !== 'active') return NONE;
  const recorded = chronological(input.sessions.filter((item) => item.status === 'completed' && input.statusBySession.has(item.id)));
  const last = recorded.at(-1);
  if (!last || input.statusBySession.get(last.id) !== 'absent') return NONE;
  const at = input.followups.get(last.id);
  return at ? { kind: 'relaunched', sessionId: last.id, sessionNumber: last.number, at } : { kind: 'to_relaunch', sessionId: last.id, sessionNumber: last.number };
}

export function countToRelaunch(states: readonly FollowupState[]) {
  return states.filter((state) => state.kind === 'to_relaunch').length;
}

const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });

/** « Relancé·e le 21 nov. » (jour à Paris). */
export function relaunchedLabel(at: string) {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? 'Relancé·e' : `Relancé·e le ${SHORT_DATE.format(date)}`;
}

// ── Groupes ─────────────────────────────────────────────────────────────────
export type GroupBucket = 'current' | 'upcoming' | 'finished';

const OPEN_SESSIONS = new Set(['planned', 'in_progress']);

/**
 * Rangement d'un groupe. Terminé : statut terminé ou archivé, ou plus aucune séance prévue alors que
 * toutes les séances du programme sont faites (ou que la date de fin est passée) ; à venir : pas encore
 * commencé ; en cours : le reste.
 */
export function groupBucket(
  group: { status: string; startDate: string | null; endDate: string | null; totalSessions: number },
  sessions: readonly OrgSession[],
  today: string,
): GroupBucket {
  if (group.status === 'completed' || group.status === 'archived') return 'finished';
  if (displayGroupStatus(group, today) === 'planned') return 'upcoming';
  const open = sessions.some((item) => OPEN_SESSIONS.has(item.status));
  const completed = sessions.filter((item) => item.status === 'completed').length;
  const allDone = group.totalSessions > 0 && completed >= group.totalSessions;
  const ended = group.endDate !== null && group.endDate < today;
  return !open && (allDone || ended) ? 'finished' : 'current';
}

/** Séance en cours, sinon prochaine séance prévue (aujourd'hui ou plus tard, une séance sans date en dernier). */
export function nextSession<T extends OrgSession>(sessions: readonly T[], today: string): T | null {
  const ordered = chronological(sessions);
  return ordered.find((item) => item.status === 'in_progress') ?? ordered.find((item) => isUpcomingSession(item, today)) ?? null;
}

type Arrangeable = { bucket: GroupBucket; name: string; startDate: string | null; endDate: string | null; nextDate: string | null };

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
const ascending = (a: string | null, b: string | null) => (a ?? '9999-12-31').localeCompare(b ?? '9999-12-31');
const descending = (a: string | null, b: string | null) => (b ?? '0000-01-01').localeCompare(a ?? '0000-01-01');

/** En cours : prochaine séance la plus proche d'abord ; à venir : début le plus proche ; terminés : les plus récents. */
export function arrangeGroups<T extends Arrangeable>(groups: readonly T[]): Record<GroupBucket, T[]> {
  const pick = (bucket: GroupBucket) => groups.filter((group) => group.bucket === bucket);
  return {
    current: pick('current').sort((a, b) => ascending(a.nextDate, b.nextDate) || byName(a, b)),
    upcoming: pick('upcoming').sort((a, b) => ascending(a.startDate, b.startDate) || byName(a, b)),
    finished: pick('finished').sort((a, b) => descending(a.endDate, b.endDate) || byName(a, b)),
  };
}

// ── Textes des cartes ───────────────────────────────────────────────────────
/** « A », « A et B », « A, B et C ». */
export function joinNames(names: readonly string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} et ${names.at(-1)}`;
}

/** « 09:00:00 » → « 9 h », « 09:30 » → « 9 h 30 ». */
function compactTime(value: string | null | undefined) {
  const [hours, minutes] = (value ?? '').split(':');
  if (!hours || !minutes) return '';
  return minutes === '00' ? `${Number(hours)} h` : `${Number(hours)} h ${minutes}`;
}

/** « 9 h – 12 h » : l'horaire d'une séance, assez court pour une case sur téléphone. */
export function compactTimeRange(start: string | null | undefined, end: string | null | undefined) {
  const from = compactTime(start);
  const to = compactTime(end);
  if (from && to) return `${from} – ${to}`;
  return from ? `dès ${from}` : '';
}

function day(value: string | null) {
  const date = value ? parseISO(value) : null;
  return date && isValid(date) ? date : null;
}

/** « du 23 oct. au 4 déc. 2026 » (l'année une seule fois quand elle ne change pas). */
export function dateSpan(start: string | null, end: string | null) {
  const from = day(start);
  const to = day(end);
  const full = (date: Date) => format(date, 'd MMM yyyy', { locale: fr });
  if (from && to) {
    const sameYear = from.getFullYear() === to.getFullYear();
    return `du ${sameYear ? format(from, 'd MMM', { locale: fr }) : full(from)} au ${full(to)}`;
  }
  if (from) return `à partir du ${full(from)}`;
  if (to) return `jusqu’au ${full(to)}`;
  return 'dates à définir';
}

// ── Membres ─────────────────────────────────────────────────────────────────
const byText = (a: string, b: string) => a.localeCompare(b, 'fr', { sensitivity: 'base' });

/** Membres inscrits d'abord, par nom puis prénom ; les parcours interrompus ensuite. Ordre stable après une relance. */
export function sortMembers<T extends { firstName: string; lastName: string; membership: string }>(members: readonly T[]): T[] {
  const rank = (member: T) => (member.membership === 'active' ? 0 : 1);
  return [...members].sort((a, b) => rank(a) - rank(b) || byText(a.lastName, b.lastName) || byText(a.firstName, b.firstName));
}

/**
 * Compétences « révélées » par personne : compétences distinctes (clé stable référentiel + code) ayant au
 * moins une observation validée notée, quel que soit le niveau (même règle que l'album du participant).
 */
export function revealedSkillCounts(rows: readonly { participantId: string; skillKey: string; score: number | null }[]): Map<string, number> {
  const seen = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.score === null) continue;
    const skills = seen.get(row.participantId) ?? new Set<string>();
    skills.add(row.skillKey);
    seen.set(row.participantId, skills);
  }
  return new Map([...seen].map(([participantId, skills]) => [participantId, skills.size]));
}
