import { clsx, type ClassValue } from 'clsx';
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { twMerge } from 'tailwind-merge';

/** Fusionne des classes Tailwind en résolvant les conflits. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fullName(person: { first_name?: string | null; last_name?: string | null } | null | undefined) {
  if (!person) return '';
  return [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
}

export function initials(person: { first_name?: string | null; last_name?: string | null } | null | undefined) {
  if (!person) return '?';
  const value = `${person.first_name?.[0] ?? ''}${person.last_name?.[0] ?? ''}`.toUpperCase();
  return value || '?';
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

/** 12 novembre 2026 */
export function formatDate(value: string | Date | null | undefined, fallback = 'Date à définir') {
  const date = toDate(value);
  return date ? format(date, 'd MMMM yyyy', { locale: fr }) : fallback;
}

/** jeu. 12 nov. */
export function formatShortDate(value: string | Date | null | undefined, fallback = 'À définir') {
  const date = toDate(value);
  return date ? format(date, 'EEE d MMM', { locale: fr }) : fallback;
}

/** 12/11/2026 */
export function formatNumericDate(value: string | Date | null | undefined, fallback = '—') {
  const date = toDate(value);
  return date ? format(date, 'dd/MM/yyyy') : fallback;
}

/** 12 novembre 2026 à 14:05 */
export function formatDateTime(value: string | Date | null | undefined, fallback = '—') {
  const date = toDate(value);
  return date ? format(date, "d MMMM yyyy 'à' HH:mm", { locale: fr }) : fallback;
}

/** il y a 3 jours */
export function formatRelative(value: string | Date | null | undefined, fallback = '') {
  const date = toDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true, locale: fr }) : fallback;
}

/** « 09:00:00 » → « 9 h 00 » */
export function formatTime(value: string | null | undefined, fallback = '') {
  if (!value) return fallback;
  const [hours, minutes] = value.split(':');
  if (hours === undefined || minutes === undefined) return fallback;
  return `${Number(hours)} h ${minutes}`;
}

export function formatTimeRange(start: string | null | undefined, end: string | null | undefined) {
  const from = formatTime(start);
  const to = formatTime(end);
  if (from && to) return `${from} – ${to}`;
  return from || to || 'Horaire à définir';
}

/** 180 → « 3 h », 95 → « 1 h 35 » */
export function formatDuration(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** Nombre décimal lisible : 3 → « 3 », 3.5 → « 3,5 » */
export function formatScore(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value)} %`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`;
}

/** Retire les accents et met en minuscules, pour les recherches. */
export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** N'accepte qu'un chemin interne comme cible de redirection (évite les redirections ouvertes). */
export function safeInternalPath(value: string | null | undefined, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
