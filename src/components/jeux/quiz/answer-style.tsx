import { Circle, Diamond, Hexagon, Square, Star, Triangle, type LucideIcon } from 'lucide-react';

/**
 * Chaque réponse a une couleur ET une forme ET une lettre : la couleur n'est jamais seule
 * à porter l'information (daltonisme, projecteur peu contrasté).
 */
export type AnswerStyle = { bg: string; text: string; icon: LucideIcon; letter: string };

export const ANSWER_STYLES: AnswerStyle[] = [
  { bg: 'bg-danger', text: 'text-white', icon: Diamond, letter: 'A' },
  { bg: 'bg-chart-observed', text: 'text-white', icon: Circle, letter: 'B' },
  { bg: 'bg-orange-500', text: 'text-petrol-950', icon: Triangle, letter: 'C' },
  { bg: 'bg-petrol-600', text: 'text-white', icon: Square, letter: 'D' },
  { bg: 'bg-success', text: 'text-white', icon: Hexagon, letter: 'E' },
  { bg: 'bg-warning', text: 'text-white', icon: Star, letter: 'F' },
];

export function answerStyle(index: number): AnswerStyle {
  return ANSWER_STYLES[index % ANSWER_STYLES.length];
}
