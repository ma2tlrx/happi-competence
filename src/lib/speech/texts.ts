import type { Passport } from '@/lib/passport';
import type { ReportContent } from '@/lib/report/content';

/**
 * Textes lus à voix haute dans l'espace du participant. Ils ne reprennent que ce qui
 * est déjà affiché : le texte d'un bilan validé, ou les compétences observées du
 * passeport avec leur libellé de niveau (jamais de chiffre, rien sur les compétences
 * non observées).
 */
export function reportListenText(content: ReportContent) {
  return [content.introduction, content.profile.summary, content.conclusion, content.closing].map((text) => text.trim()).filter(Boolean).join('\n\n');
}

export function passportListenText(passport: Passport) {
  const parts: string[] = [];
  for (const framework of passport.frameworks) {
    const observed = framework.skills.filter((skill) => skill.summary.value !== null && skill.level);
    if (observed.length === 0) continue;
    parts.push(`${framework.name}. ${observed.length} compétence${observed.length > 1 ? 's' : ''} observée${observed.length > 1 ? 's' : ''} par vos formateurs.`);
    for (const skill of observed) parts.push(`${skill.name} : ${skill.level!.label}.`);
  }
  if (parts.length === 0) return 'Vos formateurs n’ont pas encore validé d’observation.';
  return parts.join('\n');
}
