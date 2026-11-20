import type { Metadata } from 'next';

import { GameShell } from '@/components/jeux/shared/game-shell';
import { UndercoverHost } from '@/components/jeux/undercover/undercover-host';
import { requireGamesAccess } from '@/lib/jeux/page-access';

export const metadata: Metadata = { title: 'Animer une partie Undercover' };

/** Écran de l'animateur (projecteur) : accès réservé, contrôlé côté serveur, dans la mise en page immersive des jeux. */
export default async function UndercoverHostPage({ params }: { params: Promise<{ gameId: string }> }) {
  await requireGamesAccess();
  const { gameId } = await params;
  return (
    <GameShell>
      <UndercoverHost gameId={gameId} />
    </GameShell>
  );
}
