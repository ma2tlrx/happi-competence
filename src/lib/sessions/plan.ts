/**
 * Planification des sessions d'un groupe — module pur, partagé par le formulaire (valeurs de départ,
 * « Recopier sur les suivantes ») et par l'action serveur (lecture et vérification des lignes).
 *
 * Chaque session a sa propre date, son horaire et son lieu, tous facultatifs. Les dates renseignées
 * suivent l'ordre des sessions (la dernière, le bilan individuel, clôt le parcours) ; deux sessions
 * peuvent tomber le même jour. Clés des champs et des erreurs : « date-3 », « start-3 », « end-3 », « location-3 ».
 */

export const LOCATION_MAX = 200;
export const DEFAULT_START = '09:00';
export const DEFAULT_END = '12:00';

/** Une ligne du formulaire, telle que saisie (chaîne vide quand rien n'est renseigné). */
export type PlanRow = { number: number; date: string; start: string; end: string; location: string };
/** Session déjà planifiée du groupe, prise en compte pour l'ordre des dates. */
export type PlannedSession = { number: number; date: string | null };
/** Session prête à être enregistrée. */
export type SessionPlan = { number: number; date: string | null; start: string | null; end: string | null; location: string | null };
export type PlanCheck = { ok: true; sessions: SessionPlan[] } | { ok: false; errors: Record<string, string> };

export type PlanField = 'date' | 'start' | 'end' | 'location';

/** Nom du champ de formulaire, qui sert aussi de clé d'erreur. */
export const fieldName = (field: PlanField, number: number) => `${field}-${number}`;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Ajoute des jours à une date AAAA-MM-JJ (calcul en UTC : pas d'effet des changements d'heure). */
function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Lit les lignes des sessions demandées dans les données envoyées par le formulaire. */
export function readPlanRows(form: Pick<FormData, 'get'>, numbers: number[]): PlanRow[] {
  const read = (field: PlanField, number: number) => {
    const value = form.get(fieldName(field, number));
    return typeof value === 'string' ? value.trim() : '';
  };
  return numbers.map((number) => ({
    number,
    date: read('date', number),
    start: read('start', number),
    end: read('end', number),
    location: read('location', number),
  }));
}

type Dated = { number: number; date: string; planned: boolean };

/** Erreur d'ordre d'une date : comparée à la session précédente la plus tardive, puis à la suivante déjà planifiée la plus précoce. */
function orderError(number: number, date: string, dated: Dated[]) {
  let before: Dated | null = null;
  let after: Dated | null = null;
  for (const session of dated) {
    // Liste triée par numéro : à date égale, on retient la session la plus proche.
    if (session.number < number && (!before || session.date >= before.date)) before = session;
    if (session.planned && session.number > number && (!after || session.date < after.date)) after = session;
  }
  if (before && date < before.date) return `Cette date précède celle de la session ${before.number}.`;
  // Seules les sessions déjà planifiées servent ici : une session du formulaire mal placée est signalée sur sa propre ligne.
  if (after && date > after.date) return `Cette date suit celle de la session ${after.number}.`;
  return null;
}

/** Vérifie chaque ligne (formats, fin après début, lieu, ordre des dates) ; erreurs rattachées au champ fautif. */
export function checkPlan(rows: PlanRow[], planned: PlannedSession[] = []): PlanCheck {
  const errors: Record<string, string> = {};
  const dated: Dated[] = [
    ...planned.flatMap((session) => (session.date && isDate(session.date) ? [{ number: session.number, date: session.date, planned: true }] : [])),
    ...rows.flatMap((row) => (isDate(row.date) ? [{ number: row.number, date: row.date, planned: false }] : [])),
  ].sort((a, b) => a.number - b.number);

  for (const row of rows) {
    const key = (field: PlanField) => fieldName(field, row.number);
    if (row.date) {
      const error = isDate(row.date) ? orderError(row.number, row.date, dated) : 'Date invalide.';
      if (error) errors[key('date')] = error;
    }
    const startOk = !row.start || TIME.test(row.start);
    const endOk = !row.end || TIME.test(row.end);
    if (!startOk) errors[key('start')] = 'Horaire invalide.';
    if (!endOk) errors[key('end')] = 'Horaire invalide.';
    if (startOk && endOk && row.start && row.end && row.end <= row.start) errors[key('end')] = 'L’heure de fin doit suivre l’heure de début.';
    if (row.location.trim().length > LOCATION_MAX) errors[key('location')] = `Le lieu est trop long (${LOCATION_MAX} caractères au plus).`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    sessions: rows.map((row) => ({
      number: row.number,
      date: row.date || null,
      start: row.start || null,
      end: row.end || null,
      location: row.location.trim() || null,
    })),
  };
}

/** Valeurs de départ : une date par semaine depuis le début du groupe (selon le numéro de la session), 09:00–12:00, lieu vide. */
export function initialRows(sessions: { number: number }[], startDate: string | null): PlanRow[] {
  const start = startDate && isDate(startDate) ? startDate : null;
  return sessions.map(({ number }) => ({
    number,
    date: start ? addDays(start, Math.max(0, number - 1) * 7) : '',
    start: DEFAULT_START,
    end: DEFAULT_END,
    location: '',
  }));
}

/** Ligne de départ de « Recopier sur les suivantes » : la première datée, sinon la première remplie (-1 si aucune). */
export function firstFilledIndex(rows: PlanRow[]) {
  const dated = rows.findIndex((row) => row.date);
  return dated >= 0 ? dated : rows.findIndex((row) => row.start || row.end || row.location.trim());
}

/** Recopie une ligne sur les suivantes : une semaine plus tard par session, mêmes horaires et même lieu. */
export function copyForward(rows: PlanRow[], from: number): PlanRow[] {
  const source = rows[from];
  if (!source) return rows;
  const date = isDate(source.date) ? source.date : null;
  return rows.map((row, index) => {
    if (index <= from) return row;
    const next = date ? addDays(date, (row.number - source.number) * 7) : row.date;
    return { ...row, date: next, start: source.start, end: source.end, location: source.location };
  });
}
