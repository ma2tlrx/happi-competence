import type { Metadata } from 'next';

import { PasseportNumeriqueFrame } from '@/components/passeport-numerique/app-frame';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Passeport Numérique' };

/** Espace animateur du Passeport Numérique, ouvert sans code pour un formateur ou un administrateur, en plein écran. */
export default async function TrainerPasseportNumeriquePage() {
  await requireRole('formateur', 'admin');
  return <PasseportNumeriqueFrame />;
}
