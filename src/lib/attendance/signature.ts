/**
 * Signatures d'émargement : tracé vectoriel compact « M x y L x y … » en coordonnées
 * entières dans un cadre de 600 × 200. Ce format est rendu tel quel en SVG (écran) et
 * dans le PDF, et il est validé à l'identique par la base (private.valid_signature_path).
 */
export const SIGNATURE_WIDTH = 600;
export const SIGNATURE_HEIGHT = 200;
export const MAX_SIGNATURE_PATH_LENGTH = 24_000;
const MIN_POINTS = 5;
const MIN_EXTENT = 15;
const PATH_PATTERN = /^M\d{1,3} \d{1,3}( [ML]\d{1,3} \d{1,3})*$/;

export type Point = { x: number; y: number };

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(value)));

function encode(strokes: Point[][], minDistance: number) {
  const parts: string[] = [];
  for (const stroke of strokes) {
    let last: Point | null = null;
    stroke.forEach((point, index) => {
      const x = clamp(point.x, SIGNATURE_WIDTH);
      const y = clamp(point.y, SIGNATURE_HEIGHT);
      const isLast = index === stroke.length - 1;
      if (last && !isLast && Math.hypot(x - last.x, y - last.y) < minDistance) return;
      if (last && last.x === x && last.y === y) return;
      parts.push(`${last ? 'L' : 'M'}${x} ${y}`);
      last = { x, y };
    });
    // Un simple point reste visible : on le double d'un segment d'un pixel.
    if (stroke.length > 0 && parts.at(-1)?.startsWith('M')) {
      const point = last as Point | null;
      if (point) parts.push(`L${Math.min(SIGNATURE_WIDTH, point.x + 1)} ${point.y}`);
    }
  }
  return parts.join(' ');
}

/** Convertit des traits (coordonnées du cadre 600 × 200) en tracé borné, simplifié si nécessaire. */
export function strokesToPath(strokes: Point[][]): string {
  const usable = strokes.filter((stroke) => stroke.length > 0);
  for (let minDistance = 2; minDistance <= 40; minDistance += 2) {
    const path = encode(usable, minDistance);
    if (path.length <= MAX_SIGNATURE_PATH_LENGTH) return path;
  }
  // Tracé démesuré même simplifié : refusé par la validation (chaîne vide).
  return '';
}

/** Points du tracé (pour les contrôles et l'aperçu). */
export function pathPoints(path: string): Point[] {
  return [...path.matchAll(/[ML](\d+) (\d+)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
}

export type SignatureCheck = { ok: true } | { ok: false; message: string };

/** Contrôle serveur d'un tracé reçu du navigateur (mêmes règles que la base, plus une étendue minimale). */
export function validateSignaturePath(path: unknown): SignatureCheck {
  if (typeof path !== 'string' || path.length === 0) return { ok: false, message: 'Signez dans le cadre avant de valider.' };
  if (path.length > MAX_SIGNATURE_PATH_LENGTH) return { ok: false, message: 'Signature trop longue : effacez et signez plus simplement.' };
  if (!PATH_PATTERN.test(path)) return { ok: false, message: 'Signature illisible : effacez et recommencez.' };
  const points = pathPoints(path);
  if (points.some((point) => point.x > SIGNATURE_WIDTH || point.y > SIGNATURE_HEIGHT)) {
    return { ok: false, message: 'Signature illisible : effacez et recommencez.' };
  }
  if (points.length < MIN_POINTS) return { ok: false, message: 'Signature trop courte : signez comme sur papier.' };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  if (Math.max(...xs) - Math.min(...xs) < MIN_EXTENT && Math.max(...ys) - Math.min(...ys) < MIN_EXTENT) {
    return { ok: false, message: 'Signature trop courte : signez comme sur papier.' };
  }
  return { ok: true };
}

/** Statuts de présence qui ouvrent droit à l'émargement (et comptent dans les heures réalisées). */
export const SIGNABLE_STATUSES = ['present', 'late', 'left_early'] as const;
export function isSignableStatus(status: string | null | undefined): status is (typeof SIGNABLE_STATUSES)[number] {
  return (SIGNABLE_STATUSES as readonly string[]).includes(status ?? '');
}

/** Date du jour à Paris (AAAA-MM-JJ), comme private.paris_today() côté base. */
export function parisDate(date = new Date()) {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Fenêtre d'émargement : le jour de la séance ou pendant qu'elle est en cours (même règle que la base). */
export function isSignatureWindowOpen(session: { status: string; scheduled_date: string | null }, today = parisDate()) {
  return session.status !== 'cancelled' && (session.status === 'in_progress' || session.scheduled_date === today);
}

export const SIGNATURE_METHOD_LABEL: Record<string, string> = {
  trainer_device: 'Tablette du formateur',
  own_account: 'Compte du participant',
};
