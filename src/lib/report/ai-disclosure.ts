/**
 * Mention de transparence sur l'usage de l'IA (règlement (UE) 2024/1689, art. 50),
 * affichée dans le PDF du bilan et dans l'affichage web des bilans validés.
 */
export type ContentSource = 'ai' | 'ai_edited' | 'manual' | null | undefined;

export const AI_WRITING_MENTION = 'Texte rédigé avec l’aide d’une intelligence artificielle, relu et validé par le formateur';
export const MANUAL_WRITING_MENTION = 'Rédigé par le formateur';

/** Mention à afficher selon l'origine du texte ; `null` si le texte n'a pas encore été rédigé. */
export function writingMention(source: ContentSource) {
  if (source === 'ai' || source === 'ai_edited') return AI_WRITING_MENTION;
  if (source === 'manual') return MANUAL_WRITING_MENTION;
  return null;
}
