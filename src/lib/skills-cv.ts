import type { Passport } from '@/lib/passport';

/**
 * CV de compétences « Mes compétences observées » : une page, choisie par le
 * participant. Seules des données déjà publiques dans son passeport partagé y
 * figurent : compétences observées, libellé du niveau validé, une phrase de
 * description du niveau, programme et dates. Jamais : commentaires des formateurs,
 * présences, organisme, auto-évaluation, valeurs chiffrées.
 */

/** Nombre maximal de compétences : le document tient sur une page. */
export const CV_MAX_SKILLS = 14;

export const CV_METHOD_MENTION = 'Observé en situation collective par un formateur HAPPI ; non une certification.';

export type SkillsCvSkill = { code: string; name: string; levelLabel: string; descriptor: string | null; toConfirm: boolean };
export type SkillsCv = {
  name: string;
  program: { name: string; startDate: string | null; endDate: string | null } | null;
  frameworks: { name: string; isProvisional: boolean; skills: SkillsCvSkill[] }[];
};

/** Première phrase d'un texte, raccourcie si besoin. */
export function firstSentence(text: string | null | undefined, max = 170) {
  const value = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return null;
  const match = /^(.+?[.!?…])(?:\s|$)/.exec(value);
  const sentence = match ? match[1]! : value;
  if (sentence.length <= max) return sentence;
  const cut = sentence.lastIndexOf(' ', max - 1);
  return `${sentence.slice(0, cut > 0 ? cut : max - 1)}…`;
}

/** Compétences observées (niveau validé), proposées au choix du participant. */
export function observedSkillOptions(passport: Passport) {
  return passport.frameworks.flatMap((framework) =>
    framework.skills.filter((skill) => skill.summary.value !== null && skill.level).map((skill) => ({ code: skill.code, name: skill.name, framework: framework.name, levelLabel: skill.level!.label })),
  );
}

/**
 * Contenu du CV. `selected` : codes choisis (null = toutes les compétences observées).
 * Un code inconnu ou non observé est ignoré ; au plus CV_MAX_SKILLS compétences.
 */
export function buildSkillsCv(passport: Passport, selected: string[] | null): SkillsCv {
  const wanted = selected ? new Set(selected) : null;
  let remaining = CV_MAX_SKILLS;
  const frameworks = passport.frameworks
    .map((framework) => {
      const skills: SkillsCvSkill[] = [];
      for (const skill of framework.skills) {
        if (skill.summary.value === null || !skill.level || (wanted && !wanted.has(skill.code)) || remaining <= 0) continue;
        const levelValue = skill.level.value;
        remaining -= 1;
        skills.push({
          code: skill.code,
          name: skill.name,
          levelLabel: skill.level.label,
          descriptor: firstSentence(skill.levels.find((level) => level.value === levelValue)?.description ?? skill.level.description ?? null),
          toConfirm: skill.summary.observations.length === 1,
        });
      }
      return { name: framework.name, isProvisional: framework.isProvisional, skills };
    })
    .filter((framework) => framework.skills.length > 0);
  return {
    name: `${passport.participant.firstName} ${passport.participant.lastName}`.trim(),
    program: passport.group ? { name: passport.group.programName, startDate: passport.group.startDate, endDate: passport.group.endDate } : null,
    frameworks,
  };
}
