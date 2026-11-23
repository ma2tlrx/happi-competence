/**
 * Calendrier des sessions — logique pure (aucun accès réseau ni DOM), testée par calendar.test.ts.
 *
 * Les dates sont des chaînes AAAA-MM-JJ et les heures des chaînes HH:MM : elles désignent l'heure
 * murale de Paris, comme dans la base (scheduled_date, start_time, end_time). Les calculs de jours
 * se font en UTC pour ne subir aucun changement d'heure ; seul le « maintenant » et l'export ICS
 * passent par le fuseau Europe/Paris.
 */

export const TIME_ZONE = 'Europe/Paris';

export type CalendarView = 'mois' | 'semaine' | 'agenda';
export const CALENDAR_VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'mois', label: 'Mois' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'agenda', label: 'Agenda' },
];

export type DbSessionStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type DisplayStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';

/** Session telle que le calendrier l'affiche (données sérialisables, lien déjà résolu selon le rôle). */
export type CalendarEvent = {
  id: string;
  number: number;
  title: string;
  /** AAAA-MM-JJ (heure de Paris). */
  date: string;
  /** HH:MM ou null. */
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  status: DbSessionStatus;
  groupId: string;
  groupName: string;
  organizationName: string | null;
  trainerNames: string[];
  href: string;
};

// ── Dates ───────────────────────────────────────────────────────────────────
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(iso: string, days: number) {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** Premier jour du mois, décalé de `months` mois. */
export function addMonths(iso: string, months: number) {
  const date = toUtc(iso);
  return toIso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)));
}

export const startOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;
export function endOfMonth(iso: string) {
  return addDays(addMonths(iso, 1), -1);
}

/** Jour de la semaine, lundi = 0 … dimanche = 6. */
export function weekdayIndex(iso: string) {
  return (toUtc(iso).getUTCDay() + 6) % 7;
}

export const startOfWeek = (iso: string) => addDays(iso, -weekdayIndex(iso));

export function weekDays(anchor: string) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export type GridDay = { date: string; inMonth: boolean };

/** Semaines complètes (lundi → dimanche) qui recouvrent le mois de `anchor`. */
export function monthGrid(anchor: string): GridDay[][] {
  const first = startOfMonth(anchor);
  const last = endOfMonth(anchor);
  const weeks: GridDay[][] = [];
  for (let start = startOfWeek(first); start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => { const date = addDays(start, index); return { date, inMonth: date.slice(0, 7) === first.slice(0, 7) }; }));
  }
  return weeks;
}

/** Plage de dates (incluses) à lire pour la vue : une seule requête par affichage. */
export function rangeFor(view: CalendarView, anchor: string): { from: string; to: string } {
  if (view === 'semaine') return { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 6) };
  if (view === 'agenda') return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  const weeks = monthGrid(anchor);
  return { from: weeks[0]![0]!.date, to: weeks.at(-1)!.at(-1)!.date };
}

export function shiftAnchor(view: CalendarView, anchor: string, direction: 1 | -1) {
  return view === 'semaine' ? addDays(anchor, 7 * direction) : addMonths(anchor, direction);
}

export function parseView(value: string | undefined): CalendarView {
  return value === 'semaine' || value === 'agenda' ? value : 'mois';
}

// ── Fuseau Europe/Paris ─────────────────────────────────────────────────────
const parisParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function partsOf(date: Date) {
  const map: Record<string, string> = {};
  for (const part of parisParts.formatToParts(date)) map[part.type] = part.value;
  return map as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;
}

/** Date et heure de Paris à l'instant donné. */
export function parisNow(now = new Date()): { date: string; time: string } {
  const p = partsOf(now);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Instant (UTC) correspondant à une date et une heure murales de Paris. */
export function parisLocalToUtc(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  // Deux passes : le décalage de Paris dépend de l'instant, et l'instant du décalage.
  let guess = wanted;
  for (let pass = 0; pass < 2; pass += 1) {
    const p = partsOf(new Date(guess));
    const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    guess += wanted - shown;
  }
  return new Date(guess);
}

// ── Statut ──────────────────────────────────────────────────────────────────
export const STATUS_LABEL: Record<DisplayStatus, string> = {
  upcoming: 'À venir',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

/**
 * Statut montré à l'utilisateur. Annulée, terminée et en cours viennent de la base ; une session
 * « planifiée » est déduite de l'heure de Paris : à venir, en cours pendant son créneau (toute la
 * journée si elle n'a pas d'horaire), terminée une fois passée.
 */
export function displayStatus(event: Pick<CalendarEvent, 'status' | 'date' | 'startTime' | 'endTime'>, now: { date: string; time: string }): DisplayStatus {
  if (event.status === 'cancelled') return 'cancelled';
  if (event.status === 'completed') return 'completed';
  if (event.status === 'in_progress') return 'in_progress';
  if (event.date > now.date) return 'upcoming';
  if (event.date < now.date) return 'completed';
  if (event.startTime && now.time < event.startTime) return 'upcoming';
  if (event.endTime && now.time >= event.endTime) return 'completed';
  return 'in_progress';
}

// ── Regroupement ────────────────────────────────────────────────────────────
function compareEvents(a: CalendarEvent, b: CalendarEvent) {
  return (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.number - b.number || a.groupName.localeCompare(b.groupName, 'fr');
}

/** Sessions par jour, triées : sans horaire en tête, puis par heure de début. */
export function groupByDay(events: CalendarEvent[]) {
  const days = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = days.get(event.date);
    if (list) list.push(event);
    else days.set(event.date, [event]);
  }
  for (const list of days.values()) list.sort(compareEvents);
  return days;
}
