import type { Metadata } from 'next';

import { GameShell } from '@/components/jeux/shared/game-shell';
import { JoinForm } from '@/components/jeux/join-form';
import { normalizeCode } from '@/lib/jeux/client-undercover';

export const metadata: Metadata = { title: 'Rejoindre une partie' };

/** Accès public des joueurs : code de la partie (saisi ou arrivé par QR code), puis pseudo. */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const { code } = await searchParams;
  const raw = Array.isArray(code) ? code[0] : code;
  return (
    <GameShell>
      <JoinForm initialCode={raw ? normalizeCode(raw) : ''} />
    </GameShell>
  );
}
