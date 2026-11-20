/**
 * Pseudo de jeu : ce que voient les autres joueurs et l'animateur. Filtre SIMPLE et documenté
 * (docs/jeux.md) : il écarte les cas évidents, il ne remplace ni la vigilance de l'animateur
 * ni la possibilité de retirer un joueur. Logique pure, sans dépendance serveur.
 *
 * Règles :
 *  - 2 à 20 caractères après normalisation des espaces ;
 *  - ni caractère de contrôle ni chevron ;
 *  - ni adresse e-mail, ni adresse web, ni numéro de téléphone (arobase, « http », « www », 6 chiffres ou plus) ;
 *  - ni insulte ou propos haineux évidents (liste courte ci-dessous, comparée sans accents, majuscules
 *    ni séparateurs, avec les substitutions courantes 0→o, 1→i, 3→e, 4→a, 5→s, @→a, $→s).
 */

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

/** Mots refusés tels quels. Les mots courts ne sont refusés que s'ils forment tout le pseudo ou un mot entier. */
const BLOCKED_WORDS = [
  'connard', 'connasse', 'salope', 'salaud', 'encule', 'enfoire', 'batard', 'pute', 'putain', 'merde', 'nique', 'niquer', 'fdp', 'ntm', 'tg',
  'pd', 'pede', 'tapette', 'negre', 'bougnoul', 'bicot', 'youpin', 'chintoque', 'nazi', 'hitler', 'sieg heil', 'heil', 'retarde', 'mongol', 'suicide',
  'viol', 'violeur', 'pedophile', 'terroriste', 'daesh',
];
/** En dessous de cette longueur un mot n'est cherché que comme mot entier (évite par exemple « nique » dans « Dominique »). */
const SUBSTRING_MIN = 6;

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '@': 'a', $: 's', '!': 'i' };

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[01345@$!]/g, (c) => LEET[c] ?? c);
}

export type NicknameCheck = { ok: true; nickname: string } | { ok: false; message: string };

/** Espaces normalisés (début, fin, répétés). */
export function cleanNickname(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function checkNickname(raw: string): NicknameCheck {
  const nickname = cleanNickname(raw);
  if (nickname.length < NICKNAME_MIN) return { ok: false, message: `Le pseudo doit faire au moins ${NICKNAME_MIN} caractères.` };
  if (nickname.length > NICKNAME_MAX) return { ok: false, message: `Le pseudo ne doit pas dépasser ${NICKNAME_MAX} caractères.` };
  if (/[\u0000-\u001f\u007f<>]/.test(nickname)) return { ok: false, message: 'Ce pseudo contient des caractères non autorisés.' };

  const lower = nickname.toLowerCase();
  if (/@|https?:|www\.|\.(com|fr|net|org)\b/.test(lower)) {
    return { ok: false, message: 'Le pseudo ne doit contenir ni adresse e-mail ni adresse web.' };
  }
  if ((nickname.match(/\d/g) ?? []).length >= 6) {
    return { ok: false, message: 'Le pseudo ne doit pas contenir de numéro de téléphone.' };
  }

  // Comparaison sans substitutions pour les chiffres déjà testés : on replie ensuite sur lettres seulement.
  const folded = fold(nickname);
  const words = folded.split(/[^a-z]+/).filter(Boolean);
  const compact = folded.replace(/[^a-z]/g, '');
  for (const blocked of BLOCKED_WORDS) {
    const target = blocked.replace(/ /g, '');
    if (blocked.length >= SUBSTRING_MIN ? compact.includes(target) : words.includes(target)) {
      return { ok: false, message: 'Ce pseudo n’est pas autorisé. Choisissez-en un autre.' };
    }
  }
  return { ok: true, nickname };
}

/**
 * Pseudo proposé par défaut : prénom et initiale du nom (« Inès M. »). Jamais le nom complet.
 * Retombe sur le prénom seul s'il dépasse la longueur autorisée, puis sur « Joueur » s'il est vide ou refusé.
 */
export function suggestNickname(firstName: string, lastName: string): string {
  const first = cleanNickname(firstName ?? '');
  const initial = Array.from(cleanNickname(lastName ?? ''))[0]?.toLocaleUpperCase('fr-FR');
  const candidates = [initial ? `${first} ${initial}.` : first, first].filter((c) => c.length > 0);
  for (const candidate of candidates) {
    const trimmed = Array.from(candidate).slice(0, NICKNAME_MAX).join('').trim();
    if (checkNickname(trimmed).ok) return trimmed;
  }
  return 'Joueur';
}
