import { z } from 'zod';

import { SCORE_PATTERN, type ContentIssue, type ReportContent } from './content';
import type { ReportData } from './model';
import { redactPersonalData } from './redact';

/**
 * Version « facile à lire » d'un bilan validé : phrases courtes, mots simples, une
 * idée par phrase, inspirée des règles européennes du FALC (Facile à lire et à
 * comprendre). Elle n'est pas certifiée FALC (la certification suppose une relecture
 * par des personnes concernées). Elle reprend uniquement le contenu du bilan validé :
 * aucune note chiffrée, rien sur les compétences non observées.
 */

export const EASY_READ_MENTION = 'Version facile à lire, inspirée des règles européennes du FALC (Facile à lire et à comprendre), non certifiée.';
export const EASY_READ_AI_MENTION = 'Texte proposé par une intelligence artificielle à partir du bilan validé, relu et validé par le formateur.';
export const EASY_READ_MANUAL_MENTION = 'Texte rédigé par le formateur à partir du bilan validé.';

export function easyReadWritingMention(source: 'ai' | 'ai_edited' | 'manual' | null | undefined) {
  return source === 'manual' ? EASY_READ_MANUAL_MENTION : EASY_READ_AI_MENTION;
}

export const easyReadSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.string().describe('Titre court, une question ou quelques mots simples (« Ce que vous savez bien faire »).'),
        sentences: z.array(z.string()).describe('Phrases courtes, une idée par phrase.'),
      }),
    )
    .describe('De 3 à 6 parties courtes.'),
});
export type EasyReadContent = z.infer<typeof easyReadSchema>;

export const EASY_READ_LIMITS = { sections: 8, sentencesPerSection: 12, titleLength: 70, sentenceLength: 140, sentenceWords: 18 } as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const wholeWord = (value: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`, 'giu');

/**
 * Contrôles d'une version facile à lire, dans l'esprit de `checkContent` :
 * - aucune note ni niveau chiffré ;
 * - rien sur les compétences non observées ;
 * - phrases courtes (longueur, nombre de mots), une seule phrase par ligne, pas de point-virgule ;
 * - nombre de parties et de phrases borné.
 */
export function checkEasyRead(content: EasyReadContent, data: ReportData): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const skills = data.frameworks.flatMap((framework) => framework.skills);
  const observedNames = skills.filter((skill) => skill.status !== 'not_observed').map((skill) => skill.name).sort((a, b) => b.length - a.length);
  const unobserved = skills.filter((skill) => skill.status === 'not_observed').map((skill) => skill.name);

  if (content.sections.length === 0) issues.push({ path: 'sections', message: 'Ajoutez au moins une partie.' });
  if (content.sections.length > EASY_READ_LIMITS.sections) issues.push({ path: 'sections', message: `${EASY_READ_LIMITS.sections} parties au plus.` });

  const checkText = (path: string, text: string) => {
    if (SCORE_PATTERN.test(text)) issues.push({ path, message: 'Pas de note ni de niveau chiffré : les niveaux sont dans le bilan.' });
    // Les noms des compétences observées sont retirés d'abord : « Organisation » peut être contenu dans « Organisation du temps ».
    let rest = text;
    for (const name of observedNames) rest = rest.replace(wholeWord(name), ' ');
    for (const name of unobserved) {
      if (wholeWord(name).test(rest)) issues.push({ path, message: `« ${name} » n’a pas été observée : n’en parlez pas dans cette version.` });
    }
  };

  content.sections.forEach((section, index) => {
    const path = `sections.${index}`;
    if (!section.title.trim()) issues.push({ path: `${path}.title`, message: 'Titre vide.' });
    if (section.title.length > EASY_READ_LIMITS.titleLength) issues.push({ path: `${path}.title`, message: `Titre trop long (${EASY_READ_LIMITS.titleLength} caractères au plus).` });
    checkText(`${path}.title`, section.title);
    if (section.sentences.length === 0) issues.push({ path: `${path}.sentences`, message: 'Chaque partie contient au moins une phrase.' });
    if (section.sentences.length > EASY_READ_LIMITS.sentencesPerSection) {
      issues.push({ path: `${path}.sentences`, message: `${EASY_READ_LIMITS.sentencesPerSection} phrases au plus par partie.` });
    }
    section.sentences.forEach((sentence, position) => {
      const sentencePath = `${path}.sentences.${position}`;
      const text = sentence.trim();
      if (!text) {
        issues.push({ path: sentencePath, message: 'Phrase vide.' });
        return;
      }
      const words = text.split(/\s+/).filter(Boolean).length;
      if (text.length > EASY_READ_LIMITS.sentenceLength || words > EASY_READ_LIMITS.sentenceWords) {
        issues.push({ path: sentencePath, message: `Phrase trop longue (${words} mots) : ${EASY_READ_LIMITS.sentenceWords} mots au plus, une idée par phrase.` });
      }
      if (/[.!?…]\s+\S/.test(text) || text.includes(';')) issues.push({ path: sentencePath, message: 'Une seule phrase par ligne, une seule idée.' });
      checkText(sentencePath, text);
    });
  });
  return issues;
}

/** Texte continu, pour la lecture à voix haute et l'aperçu. */
export function easyReadToText(content: EasyReadContent) {
  return content.sections.map((section) => [section.title, ...section.sentences].join('\n')).join('\n\n');
}

/** Saisie du formateur : une phrase par ligne. */
export function sentencesFromLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export const EASY_READ_SYSTEM_PROMPT = `Tu écris la version « facile à lire » d'un bilan HAPPI déjà validé par un formateur.

HAPPI est un programme d'accompagnement vers l'emploi : en petits groupes, avec des jeux vidéo, des débats et des discussions, des formateurs observent ce que chaque personne sait faire.

Tu reçois un dossier JSON : les compétences observées (avec le libellé officiel du niveau) et le texte du bilan validé. Écris uniquement à partir de ce dossier.

Règles, inspirées des règles européennes du FALC (Facile à lire et à comprendre) :
- Des phrases courtes : 15 mots au plus si possible, jamais plus de 18.
- Une seule idée par phrase. Une phrase par élément de la liste. Pas de point-virgule.
- Des mots simples et courants. Explique un mot difficile s'il est indispensable.
- Parle directement à la personne : « vous ». Pas de prénom.
- Phrases affirmatives, à la forme active. Évite les négations quand c'est possible.
- Pas de chiffres de note, pas de « niveau 3 », pas de « 4 sur 5 ». Tu peux dire le libellé du niveau en mots, entre guillemets si besoin.
- Ne parle que des compétences observées. Ne parle jamais des compétences qui n'ont pas été observées.
- N'invente rien : aucun fait, aucun exemple, aucune situation qui ne soit pas dans le bilan.
- Pas de diagnostic, pas de jugement sur la personne, pas de mots qui blessent.
- Si une compétence a été vue une seule fois, dis que c'est « à confirmer ».

Structure attendue : 3 à 6 parties courtes, chacune avec un titre simple, par exemple :
« Ce qu'est ce bilan », « Ce que vous savez bien faire », « Ce que vous pouvez travailler », « Les prochaines étapes », « À retenir ».`;

/**
 * Dossier transmis à l'IA : compétences observées (nom, libellé du niveau, statut) et
 * texte du bilan validé, après masquage des données personnelles. Aucune compétence
 * non observée, aucun nom, aucune structure.
 */
export function buildEasyReadDossier(data: ReportData, content: ReportContent) {
  const names = [data.participant.firstName, data.participant.lastName];
  const clean = (text: string) => redactPersonalData(text, { names });
  const observed = data.frameworks.flatMap((framework) =>
    framework.skills
      .filter((skill) => skill.status !== 'not_observed')
      .map((skill) => ({ code: skill.code, nom: skill.name, referentiel: framework.name, niveau: skill.levelLabel, a_confirmer: skill.status === 'single' })),
  );
  const observedCodes = new Set(observed.map((skill) => skill.code));
  return {
    programme: data.program?.name ?? null,
    competences_observees: observed,
    bilan: {
      introduction: clean(content.introduction),
      profil: clean(content.profile.summary),
      points_observes: content.profile.traits.map(clean),
      fiches: content.skills.filter((skill) => observedCodes.has(skill.code)).map((skill) => ({ code: skill.code, appuis: clean(skill.strengths), progres: clean(skill.progress) })),
      recommandations: content.recommendations
        .filter((item) => observedCodes.has(item.skillCode))
        .map((item) => ({ competence: item.skillCode, action: clean(item.action), objectif: clean(item.goal) })),
      synthese: clean(content.conclusion),
      mot_de_la_fin: clean(content.closing),
    },
  };
}
