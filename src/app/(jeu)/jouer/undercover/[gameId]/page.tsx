import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { GameShell } from '@/components/jeux/shared/game-shell';
import { UndercoverPlayer } from '@/components/jeux/undercover/undercover-player';
import { requirePlayer } from '@/lib/jeux/page-access';

export const metadata: Metadata = { title: 'Fourmi Caché' };

/** Écran du joueur : participant connecté (ou animateur en essai). Salon d'attente puis déroulé de la partie. */
export default async function UndercoverPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { gameId } = await params;
  const query = await searchParams;
  const playerId = typeof query.playerId === 'string' ? query.playerId : '';
  const { trial } = await requirePlayer(playerId ? `/jouer/undercover/${gameId}?playerId=${encodeURIComponent(playerId)}` : '/jouer');
  if (!playerId) redirect('/jouer');
  return (
    <GameShell>
      <UndercoverPlayer gameId={gameId} playerId={playerId} trial={trial} />
    </GameShell>
  );
}
