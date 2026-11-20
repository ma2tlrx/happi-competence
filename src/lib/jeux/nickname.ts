/**
 * Pseudo de jeu : proposition par défaut et contrôle simple côté écran.
 * Le serveur reste la référence (longueur, caractères) ; ce filtre évite seulement les erreurs évidentes :
 * adresse e-mail, numéro de téléphone, lien, insulte courante. Il n'est ni exhaustif ni infaillible.
 * Liste d'insultes volontairement courte et modifiable ici (provisoire — à valider par le propriétaire).
 */
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

/** Mots refusés (comparés sans accents ni majuscules : mot entier pour les très courts, début de mot sinon). */
const BLOCKED_WORDS = [
  'connard',
  'connasse',
  'salope',
  'putain',
  'pute',
  'encule',
  'enculer',
  'merde',
  'fdp',
  'ntm',
  'pd',
  'nique',
  'niquer',
  'batard',
  'bouffon',
  'nazi',
  'hitler',
  'negre',
  'bougnoule',
  'pedophile',
  'debile',
];

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Prénom + initiale du nom (« Marie D. »), borné à la longueur maximale. Vide si le prénom est vide. */
export function suggestNickname(firstName: string, lastName: string) {
  const first = firstName.trim().split(/\s+/)[0] ?? '';
  const initial = lastName.trim().charAt(0).toUpperCase();
  const base = initial && /\p{L}/u.test(initial) ? `${first} ${initial}.` : first;
  return base.length > NICKNAME_MAX ? first.slice(0, NICKNAME_MAX) : base;
}

/** Message d'erreur en français, ou null si le pseudo est acceptable. */
export function nicknameError(value: string): string | null {
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length < NICKNAME_MIN) return `Le pseudo doit comporter au moins ${NICKNAME_MIN} caractères.`;
  if (text.length > NICKNAME_MAX) return `Le pseudo ne peut pas dépasser ${NICKNAME_MAX} caractères.`;
  if (/[<>\u0000-\u001f\u007f]/.test(text)) return 'Ce pseudo contient des caractères non autorisés.';
  if (/@|https?:|www\.|\.(com|fr|net|org)\b/i.test(text)) return 'N’indiquez ni adresse e-mail ni lien : choisissez un simple pseudo.';
  if (text.replace(/\D/g, '').length >= 6) return 'N’indiquez pas de numéro de téléphone : choisissez un simple pseudo.';
  const words = fold(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.some((word) => BLOCKED_WORDS.some((blocked) => (blocked.length <= 3 ? word === blocked : word.startsWith(blocked))))) {
    return 'Ce pseudo n’est pas accepté. Choisissez-en un autre, respectueux des autres joueurs.';
  }
  return null;
}
