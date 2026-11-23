import type { Metadata } from 'next';

import { homePathFor } from '@/lib/auth/session';
import { GameShell } from '@/components/jeux/shared/game-shell';
import { JoinForm } from '@/components/jeux/join-form';
import { CODE_LENGTH, normalizeCode } from '@/lib/jeux/client-undercover';
import { suggestNickname } from '@/lib/jeux/nickname';
import { requirePlayer } from '@/lib/jeux/page-access';

export const metadata: Metadata = { title: 'Rejoindre une partie' };

/**
 * Accès des joueurs : réservé aux participants connectés (et aux animateurs, en essai).
 * Un visiteur non connecté passe par la connexion, qui le ramène ici avec le code d'un QR code.
 */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const { code } = await searchParams;
  const raw = Array.isArray(code) ? code[0] : code;
  const initialCode = raw ? normalizeCode(raw) : '';
  const { user, trial } = await requirePlayer(initialCode.length === CODE_LENGTH ? `/jouer?code=${initialCode}` : '/jouer');
  return (
    // Retour direct au tableau de bord : utile si l'on a cliqué ici par erreur.
    <GameShell back={{ href: homePathFor(user), label: 'Retour à mon tableau de bord' }}>
      <JoinForm initialCode={initialCode} defaultNickname={suggestNickname(user.firstName, user.lastName)} animator={trial} />
    </GameShell>
  );
}
