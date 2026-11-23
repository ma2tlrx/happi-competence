import type { Metadata } from 'next';

import { SpaceShell } from '@/components/app/shell-loader';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Bienvenue', robots: { index: false } };

/** Même coque que l'auto-évaluation (menu, en-tête, largeur de lecture) : les deux questionnaires se présentent pareil. */
export default async function BienvenueLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('participant');
  return (
    <SpaceShell space="participant" user={user}>
      {children}
    </SpaceShell>
  );
}
