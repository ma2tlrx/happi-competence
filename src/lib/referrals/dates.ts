/** Dates des entretiens : saisies et affichées à l'heure de Paris, stockées en UTC. */
const PARIS = 'Europe/Paris';

function parisWallClock(instant: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: PARIS, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
}

/** « 2026-11-20T10:00 » (champ datetime-local, heure de Paris) → ISO UTC. Nul si invalide. */
export function parisLocalToIso(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value?.trim() ?? '');
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number) as [number, number, number, number, number, number];
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  if (Number.isNaN(asUtc)) return null;
  // Décalage de Paris à cet instant (heure d'hiver ou d'été), appliqué une fois puis vérifié.
  let instant = asUtc - (parisWallClock(new Date(asUtc)) - asUtc);
  instant -= parisWallClock(new Date(instant)) - asUtc;
  return new Date(instant).toISOString();
}

/** ISO → « vendredi 20 novembre 2026 à 10:00 » (heure de Paris). */
export function formatParisDateTime(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const day = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, hour: '2-digit', minute: '2-digit' }).format(date);
  return `${day} à ${time}`;
}
