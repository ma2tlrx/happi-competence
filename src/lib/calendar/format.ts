import { addDays, endOfMonth, startOfWeek, type CalendarView } from './calendar';

/** Libellés en français des dates AAAA-MM-JJ (calculés en UTC : identiques sur le serveur et le navigateur). */
const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options });
const long = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const longYear = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const month = fmt({ month: 'long', year: 'numeric' });
const dayMonth = fmt({ day: 'numeric', month: 'long' });
const weekdayShort = fmt({ weekday: 'short' });
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** « mardi 24 novembre » */
export const dayLabel = (iso: string) => long.format(asDate(iso));
/** « mardi 24 novembre 2026 » */
export const dayLabelYear = (iso: string) => longYear.format(asDate(iso));
/** « lun. » */
export const weekdayLabel = (iso: string) => weekdayShort.format(asDate(iso));
export const dayNumber = (iso: string) => String(Number(iso.slice(8, 10)));
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Titre de la période affichée : « Novembre 2026 » ou « 23 – 29 novembre 2026 ». */
export function periodLabel(view: CalendarView, anchor: string) {
  if (view !== 'semaine') return capitalize(month.format(asDate(anchor)));
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = sameMonth ? String(Number(start.slice(8))) : dayMonth.format(asDate(start));
  return `${from} – ${dayMonth.format(asDate(end))} ${end.slice(0, 4)}`;
}

export const sessionCountLabel = (count: number) => (count === 0 ? 'aucune session' : count === 1 ? '1 session' : `${count} sessions`);

/** « 09:00 – 12:00 », « 09:00 » ou « Journée » quand aucun horaire n'est renseigné. */
export function timeLabel(start: string | null, end: string | null) {
  if (start && end) return `${start} – ${end}`;
  return start ?? end ?? 'Horaire à définir';
}

export { endOfMonth };
