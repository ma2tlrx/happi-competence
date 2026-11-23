import { THEMES, type WordPair } from '@/lib/jeux/words';

/** Logique pure du panneau « Jeux » du lecteur (aucune règle de jeu : tout reste dans /api/jeux). */
export type GameKind = 'undercover' | 'quiz';
export type StoredLaunch = { id: string; code: string; label: string };

export function pickWordPair(themeId: string, random: () => number = Math.random): WordPair {
  const theme = THEMES.find((item) => item.id === themeId) ?? THEMES[0];
  return theme.pairs[Math.min(theme.pairs.length - 1, Math.floor(random() * theme.pairs.length))];
}

export function wordsProblem(civil: string, undercover: string): string | null {
  const a = civil.trim();
  const b = undercover.trim();
  if (!a) return 'Indiquez le mot des Civils.';
  if (!b) return 'Indiquez le mot de la Fourmi.';
  if (a.length > 40 || b.length > 40) return 'Chaque mot est limité à 40 caractères.';
  if (a.toLowerCase() === b.toLowerCase()) return 'Les deux mots doivent être différents.';
  return null;
}

export const quizLaunchProblem = (questionCount: number) => (questionCount > 0 ? null : 'Ce quiz n’a encore aucune question : complétez-le avant de le lancer.');

/** Statuts de fin : Undercover `game_over`, Quiz `finished`. */
export const isResumable = (status: string) => status !== 'game_over' && status !== 'finished';

export const launchStorageKey = (sessionId: string, kind: GameKind) => `lecteur-jeu:${sessionId}:${kind}`;

export function parseStoredLaunch(raw: string | null): StoredLaunch | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null;
    if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id) return null;
    return { id: value.id, code: typeof value.code === 'string' ? value.code : '', label: typeof value.label === 'string' ? value.label : '' };
  } catch {
    return null;
  }
}

/** Écran animateur (projecteur). */
export const hostPath = (kind: GameKind, id: string) => (kind === 'undercover' ? `/jeux/undercover/partie/${encodeURIComponent(id)}` : `/jeux/quiz/partie/${encodeURIComponent(id)}`);

/** Places du salon de Quiz : au moins 10 (défaut du jeu), au plus 50 (plafond du moteur), sinon l'effectif du groupe. */
export const maxPlayersFor = (memberCount: number) => Math.max(10, Math.min(50, Math.floor(memberCount)));
