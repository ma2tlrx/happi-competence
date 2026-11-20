import type { Metadata } from 'next';

import { GameShell } from '@/components/jeux/shared/game-shell';
import { UndercoverPlayer } from '@/components/jeux/undercover/undercover-player';

export const metadata: Metadata = { title: 'Fourmi Caché' };

/** Écran du joueur (public, sans compte) : salon d'attente puis déroulé de la partie. */
export default async function UndercoverPlayerPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return (
    <GameShell>
      <UndercoverPlayer gameId={gameId} />
    </GameShell>
  );
}
