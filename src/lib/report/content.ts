import { z } from 'zod';

import type { ReportData } from './model';

/**
 * Texte d'un bilan : produit par l'IA ou rédigé par le formateur, puis relu.
 * Aucun champ ne porte de note ou de niveau : les valeurs chiffrées viennent
 * exclusivement de la photographie des résultats (ReportData).
 *
 * Le schéma n'utilise pas de contraintes de longueur (non prises en charge par les
 * sorties structurées) : les longueurs sont contrôlées par `checkContent`.
 */

/** Façons d'agir analysables en situation de jeu (section 3). Seules celles qui ont été observées sont décrites. */
export const BEHAVIOUR_THEMES = {
  difficulte: 'Aborder une difficulté',
  initiative: 'Prendre des initiatives',
  decision: 'Prendre des décisions',
  adaptation: 'S’adapter aux changements',
  echec: 'Réagir face à l’échec',
  perseverance: 'Persévérer',
  temps: 'Gérer le temps',
  cooperation: 'Coopérer',
  communication: 'Communiquer avec les autres',
  consignes: 'Comprendre et respecter les consignes',
  resolution: 'Résoudre un problème',
  organisation: 'S’organiser',
  collectif: 'S’impliquer dans une activité collective',
} as const;
export type BehaviourTheme = keyof typeof BEHAVIOUR_THEMES;
const themeCodes = Object.keys(BEHAVIOUR_THEMES) as [BehaviourTheme, ...BehaviourTheme[]];

export const PRIORITIES = {
  valoriser: 'À valoriser dès maintenant',
  consolider: 'À consolider',
  developper: 'À développer progressivement',
} as const;

export const reportContentSchema = z.object({
  introduction: z.string().describe('Introduction personnalisée, 2 ou 3 paragraphes séparés par une ligne vide.'),
  profile: z.object({
    summary: z.string().describe('Synthèse générale du profil, un paragraphe.'),
    traits: z.array(z.string()).describe('Caractéristiques comportementales observées, une phrase chacune, avec la session concernée.'),
  }),
  frameworks: z.array(z.object({ code: z.string(), summary: z.string() })).describe('Une lecture par référentiel ayant au moins une compétence observée.'),
  behaviour: z.object({
    summary: z.string().describe('Lecture d’ensemble de la façon d’agir en situation de jeu, ou constat que les données sont insuffisantes.'),
    themes: z.array(
      z.object({
        theme: z.enum(themeCodes),
        text: z.string(),
        sessions: z.array(z.number().int()).describe('Sessions évaluées sur lesquelles s’appuie ce constat.'),
      }),
    ),
  }),
  skills: z
    .array(
      z.object({
        code: z.string(),
        observed: z.string().describe('Ce qui a été observé, d’après les commentaires et niveaux fournis.'),
        strengths: z.string().describe('Points d’appui.'),
        progress: z.string().describe('Axes de progression.'),
        professional: z.string().describe('Utilité en formation, au travail ou dans la vie collective.'),
      }),
    )
    .describe('Une fiche par compétence observée, jamais pour une compétence non observée.'),
  recommendations: z.array(
    z.object({
      skillCode: z.string(),
      priority: z.enum(['valoriser', 'consolider', 'developper']),
      why: z.string(),
      action: z.string(),
      exercise: z.string(),
      worksOn: z.string(),
      goal: z.string(),
    }),
  ),
  conclusion: z.string().describe('Synthèse finale, 2 paragraphes.'),
  closing: z.string().describe('Une phrase de valorisation finale.'),
  limits: z.string().describe('Limites propres à ce bilan (données manquantes, observations uniques…).'),
  dataWarnings: z.array(z.string()).describe('Points sur lesquels les données ne permettent pas de conclure.'),
});
export type ReportContent = z.infer<typeof reportContentSchema>;

export const REPORT_SECTIONS = {
  behaviour: 'Façon d’agir en situation de jeu',
  transversal: 'Compétences transversales en détail',
  sociocognitive: 'Habiletés socio-cognitives en détail',
  feedback: 'Commentaires des formateurs par session',
  recommendations: 'Recommandations',
} as const;
export type ReportSection = keyof typeof REPORT_SECTIONS;

export const reportOptionsSchema = z.object({
  hiddenSections: z.array(z.enum(Object.keys(REPORT_SECTIONS) as [ReportSection, ...ReportSection[]])).default([]),
  structureName: z.string().trim().max(120).nullable().default(null),
  extraObservations: z.string().trim().max(3000).nullable().default(null),
});
export type ReportOptions = z.infer<typeof reportOptionsSchema>;

const LIMITS = { short: 1500, long: 4000 };
// Une note ou un niveau chiffré écrit dans le texte (« 3/5 », « 4 sur 4 », « niveau 2 ») : interdit, les chiffres viennent du moteur.
const SCORE_PATTERN = /\b\d(?:[.,]\d+)?\s*(?:\/|sur)\s*\d\b|\bniveau\s+\d\b/i;

export type ContentIssue = { path: string; message: string };

/**
 * Contrôles de cohérence entre le texte et les résultats figés. Renvoie la liste des
 * problèmes ; un texte qui en comporte n'est pas enregistré tel quel.
 */
export function checkContent(content: ReportContent, data: ReportData): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const skills = new Map(data.frameworks.flatMap((framework) => framework.skills.map((skill) => [skill.code, skill] as const)));
  const evaluated = new Set(data.sessions.filter((session) => session.evaluated).map((session) => session.number));
  for (const framework of data.frameworks) for (const skill of framework.skills) for (const o of skill.observations) evaluated.add(o.session);

  const text = (path: string, value: string, max: number) => {
    if (value.length > max) issues.push({ path, message: `Texte trop long (${value.length} caractères, ${max} au plus).` });
    if (SCORE_PATTERN.test(value)) issues.push({ path, message: 'Le texte ne doit pas citer de note ni de niveau chiffré : ils sont affichés à partir des résultats.' });
  };
  text('introduction', content.introduction, LIMITS.long);
  text('profile.summary', content.profile.summary, LIMITS.long);
  content.profile.traits.forEach((trait, index) => text(`profile.traits.${index}`, trait, LIMITS.short));
  text('behaviour.summary', content.behaviour.summary, LIMITS.long);
  text('conclusion', content.conclusion, LIMITS.long);
  text('closing', content.closing, 400);
  text('limits', content.limits, LIMITS.long);

  const frameworkCodes = new Set(data.frameworks.map((framework) => framework.code));
  content.frameworks.forEach((item, index) => {
    if (!frameworkCodes.has(item.code)) issues.push({ path: `frameworks.${index}.code`, message: `Référentiel inconnu : ${item.code}.` });
    text(`frameworks.${index}.summary`, item.summary, LIMITS.long);
  });
  content.behaviour.themes.forEach((item, index) => {
    text(`behaviour.themes.${index}.text`, item.text, LIMITS.short);
    if (item.sessions.length === 0) issues.push({ path: `behaviour.themes.${index}.sessions`, message: 'Chaque constat doit s’appuyer sur au moins une session évaluée.' });
    for (const session of item.sessions) {
      if (!evaluated.has(session)) issues.push({ path: `behaviour.themes.${index}.sessions`, message: `La session ${session} n’a pas d’évaluation validée.` });
    }
  });
  const seen = new Set<string>();
  content.skills.forEach((item, index) => {
    const skill = skills.get(item.code);
    if (!skill) issues.push({ path: `skills.${index}.code`, message: `Compétence inconnue : ${item.code}.` });
    else if (skill.status === 'not_observed') issues.push({ path: `skills.${index}.code`, message: `« ${skill.name} » n’a pas été observée : elle ne peut pas avoir de fiche commentée.` });
    if (seen.has(item.code)) issues.push({ path: `skills.${index}.code`, message: `Fiche en double : ${item.code}.` });
    seen.add(item.code);
    for (const key of ['observed', 'strengths', 'progress', 'professional'] as const) text(`skills.${index}.${key}`, item[key], LIMITS.short);
  });
  content.recommendations.forEach((item, index) => {
    if (!skills.has(item.skillCode)) issues.push({ path: `recommendations.${index}.skillCode`, message: `Compétence inconnue : ${item.skillCode}.` });
    for (const key of ['why', 'action', 'exercise', 'worksOn', 'goal'] as const) text(`recommendations.${index}.${key}`, item[key], LIMITS.short);
  });
  content.dataWarnings.forEach((warning, index) => text(`dataWarnings.${index}`, warning, LIMITS.short));
  return issues;
}

/** Texte vide, point de départ d'une rédaction manuelle : une fiche par compétence observée. */
export function emptyContent(data: ReportData): ReportContent {
  return {
    introduction: '',
    profile: { summary: '', traits: [] },
    frameworks: data.frameworks.filter((framework) => framework.observedCount > 0).map((framework) => ({ code: framework.code, summary: '' })),
    behaviour: { summary: '', themes: [] },
    skills: data.frameworks.flatMap((framework) =>
      framework.skills.filter((skill) => skill.status !== 'not_observed').map((skill) => ({ code: skill.code, observed: '', strengths: '', progress: '', professional: '' })),
    ),
    recommendations: [],
    conclusion: '',
    closing: '',
    limits: '',
    dataWarnings: [],
  };
}
