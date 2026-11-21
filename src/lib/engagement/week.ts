/**
 * Semaine du formateur : début de semaine (lundi, heure de Paris) et part du travail de saisie déjà fait.
 * Module pur. Ces chiffres ne sont visibles que du formateur lui-même : ni classement, ni suivi par la direction.
 */

/** Décalage de Paris par rapport à UTC à un instant donné, au format « +01:00 ». */
function parisOffset(date: Date) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name ?? '');
  if (!match) return '+00:00';
  return `${match[1]}${match[2]!.padStart(2, '0')}:${match[3] ?? '00'}`;
}

/** Lundi 0 h (Paris) de la semaine de `now`, en date et en horodatage ISO utilisable dans une requête. */
export function startOfWeekParis(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const weekdayIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday ?? 'Mon');
  const today = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  today.setUTCDate(today.getUTCDate() - Math.max(0, weekdayIndex));
  const date = today.toISOString().slice(0, 10);
  return { date, iso: `${date}T00:00:00${parisOffset(new Date(`${date}T12:00:00Z`))}` };
}

/**
 * Avancement de la saisie : évaluations validées cette semaine, rapportées à ce qui reste à faire.
 * `null` quand il n'y a rien eu à faire (pas de pourcentage sur zéro).
 */
export function saisieProgress(validatedThisWeek: number, pending: number): number | null {
  const total = validatedThisWeek + pending;
  if (total === 0) return null;
  return Math.round((validatedThisWeek / total) * 100);
}
