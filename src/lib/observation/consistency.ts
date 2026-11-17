/**
 * Détection d'incohérences entre un commentaire et le niveau saisi, sans IA : règles
 * simples et explicables, fondées sur un petit lexique. Le résultat est un simple
 * avertissement, jamais bloquant : le formateur reste seul juge.
 *
 * Lexique provisoire — à valider par l'équipe pédagogique HAPPI.
 */

type Term = { pattern: RegExp; weight: number };

const word = (source: string, weight = 1): Term => ({ pattern: new RegExp(`(?<![\\p{L}])${source}(?![\\p{L}])`, 'giu'), weight });

const POSITIVE: Term[] = [
  word('excellent\\p{L}*', 2),
  word('remarquable\\p{L}*', 2),
  word('parfait\\p{L}*', 2),
  word('exemplaire\\p{L}*', 2),
  word('brillant\\p{L}*', 2),
  word('impressionn\\p{L}*', 2),
  word('très bien'),
  word('très à l[’\']aise'),
  word('avec aisance'),
  word('avec facilité'),
  word('très investi\\p{L}*'),
  word('très impliqué\\p{L}*'),
  word('moteur'),
  word('efficace\\p{L}*'),
  word('pertinent\\p{L}*'),
  word('bravo'),
  word('super'),
  word('naturellement'),
  word('fédère'),
  word('autonome\\p{L}*'),
];

const NEGATIVE: Term[] = [
  word('difficult\\p{L}*'),
  word('difficile\\p{L}*'),
  word('ne parvient pas'),
  word('n[’\']a pas réussi'),
  word('n[’\']arrive pas'),
  word('a du mal'),
  word('peine à'),
  word('en retrait'),
  word('passi(?:f|ve|vité)'),
  word('refus\\p{L}*'),
  word('désengag\\p{L}*'),
  word('bloqué\\p{L}*'),
  word('perdu\\p{L}*'),
  word('insuffisa\\p{L}*', 2),
  word('très peu', 2),
  word('jamais'),
  word('aucune? initiative', 2),
  word('ne participe pas', 2),
  word('hors sujet'),
];

// Une tournure négative juste avant un terme négatif l'annule (« sans difficulté », « pas de difficulté »).
const NEGATION_BEFORE = /(?:sans|pas de|pas d[’']|aucune?|plus de)\s*$/iu;

export function commentTone(text: string) {
  const normalized = text.normalize('NFC');
  let positive = 0;
  let negative = 0;
  for (const term of POSITIVE) {
    for (const match of normalized.matchAll(term.pattern)) {
      if (/\b(?:pas|peu|plus)\s+$/iu.test(normalized.slice(Math.max(0, match.index - 8), match.index))) negative += term.weight;
      else positive += term.weight;
    }
  }
  for (const term of NEGATIVE) {
    for (const match of normalized.matchAll(term.pattern)) {
      if (NEGATION_BEFORE.test(normalized.slice(Math.max(0, match.index - 10), match.index))) positive += 1;
      else negative += term.weight;
    }
  }
  return { positive, negative };
}

export type ConsistencyWarning = { kind: 'positive_low' | 'negative_high'; message: string };

/**
 * Compare le ton d'un commentaire au niveau saisi, relativement à l'échelle :
 * - très positif (poids ≥ 2, rien de négatif) avec un niveau dans le tiers bas ;
 * - très négatif (poids ≥ 2, rien de positif) avec un niveau dans le tiers haut.
 */
export function checkConsistency({ comment, score, scaleMin, scaleMax }: { comment: string | null | undefined; score: number | null; scaleMin: number; scaleMax: number }): ConsistencyWarning | null {
  if (!comment?.trim() || score === null || scaleMax <= scaleMin) return null;
  const ratio = (score - scaleMin) / (scaleMax - scaleMin);
  const { positive, negative } = commentTone(comment);
  const epsilon = 1e-9;
  if (positive >= 2 && negative === 0 && ratio <= 1 / 3 + epsilon) {
    return { kind: 'positive_low', message: 'Le commentaire paraît très positif alors que le niveau saisi est bas. Vérifiez que l’un et l’autre disent la même chose.' };
  }
  if (negative >= 2 && positive === 0 && ratio >= 2 / 3 - epsilon) {
    return { kind: 'negative_high', message: 'Le commentaire paraît plutôt réservé alors que le niveau saisi est élevé. Vérifiez que l’un et l’autre disent la même chose.' };
  }
  return null;
}
