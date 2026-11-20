import type { Metadata } from 'next';

/** Pages de jeu : jamais indexées, ni suivies, ni mises en cache d'archive. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

/** Mise en page neutre des jeux : aucun menu du site. Chaque page pose son fond (GameShell pour les pages Undercover et /jouer). */
export default function GameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
