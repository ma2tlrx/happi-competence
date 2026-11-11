/**
 * Activités d'une session, lues dans son support pédagogique publié (titres de niveau 2).
 * Les rubriques d'organisation (accueil, apports, pause, conclusion…) sont écartées.
 */
const SKIPPED = /^(objectifs?|compétences observées|accueil|introduction|pause|conclusion|auto-évaluation|activité\s*$)/i;
const GENERIC = /^(icebreaker|activités? ludiques?|quiz de consolidation)$/i;

export function activitiesFromSupport(markdown: string | null | undefined): string[] {
  if (!markdown) return [];
  const names: string[] = [];
  for (const line of markdown.split('\n')) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const heading = match[1]!.trim();
    if (SKIPPED.test(heading)) continue;
    const [left, right] = heading.split(/\s+[—–-]\s+/, 2).map((part) => part?.trim());
    if (!left) continue;
    if (GENERIC.test(left)) {
      if (!right) continue;
      const prefix = /^quiz/i.test(left) ? 'Quiz ' : '';
      for (const part of right.split(/\s*&\s*/)) if (part) names.push(`${prefix}${part}`);
    } else if (/^débat/i.test(left)) {
      names.push('Débat thématique');
    } else {
      names.push(left);
    }
  }
  return [...new Set(names)];
}
