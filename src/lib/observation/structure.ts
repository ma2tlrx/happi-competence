import { z } from 'zod';

/**
 * Assistant d'observation : structuration des notes brutes d'un formateur en faits
 * observables rattachés aux compétences et critères de la séance.
 *
 * L'IA ne propose aucun niveau, aucune note, aucun score, aucun diagnostic ; elle
 * n'invente rien : chaque fait cite l'extrait des notes qui le justifie, et le serveur
 * vérifie que cet extrait figure bien dans les notes, que les codes existent dans la
 * séance et que le texte ne contient ni note ni vocabulaire de diagnostic. Rien n'est
 * enregistré automatiquement : le formateur choisit ce qu'il reprend, en brouillon.
 */

export type CatalogCriterion = { ref: string; id: string; label: string };
export type CatalogSkill = { code: string; id: string; name: string; description: string | null; framework: string; criteria: CatalogCriterion[] };

/** Référence courte d'un critère, stable pour une séance : code de la compétence et rang du critère. */
export function criterionRef(skillCode: string, index: number) {
  return `${skillCode}#${index + 1}`;
}

export const structuredNotesSchema = z.object({
  facts: z
    .array(
      z.object({
        skillCode: z.string().describe('Code exact d’une compétence de la liste fournie.'),
        criterionRef: z.string().nullable().describe('Référence exacte d’un critère de cette compétence, ou null.'),
        fact: z.string().describe('Fait observable, reformulé sobrement, sans jugement, sans niveau ni note.'),
        excerpt: z.string().describe('Extrait copié mot pour mot des notes, qui justifie ce fait.'),
      }),
    )
    .describe('Faits observables rattachés à une compétence de la séance.'),
  unattached: z
    .array(z.object({ excerpt: z.string().describe('Passage des notes, copié mot pour mot, qui ne se rattache à aucune compétence de la liste.') }))
    .describe('Passages non rattachés.'),
});
export type StructuredNotes = z.infer<typeof structuredNotesSchema>;

export const NOTES_MAX_LENGTH = 6000;
const FACT_MAX_LENGTH = 400;
const EXCERPT_MAX_LENGTH = 600;

// Une note ou un niveau (« 3/5 », « 4 sur 5 », « niveau », « score », « barème ») : interdit, le formateur seul attribue les niveaux.
const SCORE_WORDS = /\b\d(?:[.,]\d+)?\s*(?:\/|sur)\s*\d\b|(?<![\p{L}\p{N}])(?:niveaux?|scores?|barèmes?|sur 20)(?![\p{L}\p{N}])/iu;

/** Vocabulaire de diagnostic ou d'étiquetage psychologique : jamais dans un fait proposé. */
const DIAGNOSIS_TERMS =
  /(?<![\p{L}\p{N}])(?:troubles?|tdah|tda|hyperacti\p{L}*|autis\p{L}*|asperger|tsa|d[ée]press\p{L}*|bipolaire\p{L}*|anxi[ée]t[ée]|anxieu\p{L}*|phobi\p{L}*|patholog\p{L}*|diagnosti\p{L}*|dys(?:lexi|prax|calcul|orthograph|phas)\p{L}*|personnalit[ée]s?|narcissi\p{L}*|psychopath\p{L}*|parano\p{L}*|schizo\p{L}*|handicap\p{L}*|haut potentiel|hpi|surdou[ée]\p{L}*|immature|caract[ée]riel\p{L}*)(?![\p{L}\p{N}])/iu;

export type StructureIssue = { path: string; message: string };

export type ValidFact = {
  skillCode: string;
  skillId: string;
  skillName: string;
  criterionId: string | null;
  criterionLabel: string | null;
  fact: string;
  excerpt: string;
};

/** Normalisation pour comparer un extrait aux notes : casse, espaces, apostrophes, guillemets, ponctuation finale. */
export function normalizeForMatch(text: string) {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[«»“”"]/g, '')
    .replace(/[\s ]+/g, ' ')
    .replace(/^[\s.,;:!?…-]+|[\s.,;:!?…-]+$/g, '')
    .trim();
}

/** Vrai si l'extrait figure dans les notes (à la normalisation près). */
export function excerptInNotes(excerpt: string, notes: string) {
  const needle = normalizeForMatch(excerpt);
  if (needle.length < 3) return false;
  return normalizeForMatch(notes).includes(needle);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Contrôles serveur de la sortie de l'IA. Seuls les faits valides sont gardés ;
 * chaque fait écarté produit un problème (utilisé pour redemander une correction).
 * `levelLabels` : libellés des niveaux des référentiels de la séance, interdits dans un fait.
 */
export function validateStructured(output: StructuredNotes, catalog: CatalogSkill[], notes: string, levelLabels: string[] = []) {
  const issues: StructureIssue[] = [];
  const facts: ValidFact[] = [];
  const unattached: string[] = [];
  const skills = new Map(catalog.map((skill) => [skill.code, skill]));
  const labels = levelLabels
    .map((label) => label.trim())
    .filter((label) => label.length >= 4)
    .map((label) => new RegExp(`(?<![\\p{L}])${escapeRegExp(label)}(?![\\p{L}])`, 'iu'));

  output.facts.forEach((item, index) => {
    const path = `facts.${index}`;
    const skill = skills.get(item.skillCode);
    const problems: string[] = [];
    if (!skill) problems.push(`Compétence inconnue pour cette séance : ${item.skillCode}. Utilise uniquement les codes fournis.`);
    const criterion = skill && item.criterionRef ? skill.criteria.find((c) => c.ref === item.criterionRef) : null;
    if (skill && item.criterionRef && !criterion) problems.push(`Critère inconnu pour ${skill.code} : ${item.criterionRef}.`);
    const fact = item.fact.trim();
    if (!fact) problems.push('Fait vide.');
    if (fact.length > FACT_MAX_LENGTH) problems.push(`Fait trop long (${fact.length} caractères, ${FACT_MAX_LENGTH} au plus).`);
    if (SCORE_WORDS.test(fact) || labels.some((pattern) => pattern.test(fact))) {
      problems.push('Le fait ne doit proposer ni niveau, ni note, ni score : seul le formateur les attribue.');
    }
    if (DIAGNOSIS_TERMS.test(fact)) problems.push('Le fait ne doit contenir aucun diagnostic ni étiquette psychologique.');
    if (!item.excerpt.trim() || item.excerpt.length > EXCERPT_MAX_LENGTH || !excerptInNotes(item.excerpt, notes)) {
      problems.push('L’extrait doit être copié mot pour mot depuis les notes du formateur.');
    }
    if (problems.length) {
      for (const message of problems) issues.push({ path, message });
      return;
    }
    facts.push({
      skillCode: skill!.code,
      skillId: skill!.id,
      skillName: skill!.name,
      criterionId: criterion?.id ?? null,
      criterionLabel: criterion?.label ?? null,
      fact,
      excerpt: item.excerpt.trim(),
    });
  });

  output.unattached.forEach((item, index) => {
    const excerpt = item.excerpt.trim();
    if (!excerpt) return;
    if (excerpt.length > EXCERPT_MAX_LENGTH || !excerptInNotes(excerpt, notes)) {
      issues.push({ path: `unattached.${index}`, message: 'Le passage non rattaché doit être copié mot pour mot depuis les notes.' });
      return;
    }
    if (!unattached.includes(excerpt)) unattached.push(excerpt);
  });

  return { facts, unattached, issues };
}

/** Mention ajoutée devant tout texte repris d'une proposition de l'IA (transparence). */
export const AI_FACT_PREFIX = '[Aide IA] ';

/** Texte inséré dans le commentaire de compétence pour un fait retenu. */
export function factCommentText(fact: Pick<ValidFact, 'fact' | 'criterionLabel'>) {
  return `${AI_FACT_PREFIX}${fact.criterionLabel ? `(${fact.criterionLabel}) ` : ''}${fact.fact}`;
}

/** Ajoute un texte à un commentaire existant, sans doublon, sans dépasser la longueur permise. */
export function appendToComment(existing: string, addition: string, max: number) {
  const current = existing.trim();
  if (current.includes(addition.trim())) return existing;
  const next = current ? `${current}\n${addition.trim()}` : addition.trim();
  return next.length > max ? existing : next;
}
