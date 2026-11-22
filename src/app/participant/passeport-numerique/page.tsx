import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PasseportNumeriqueFrame } from '@/components/passeport-numerique/app-frame';
import { requireRole } from '@/lib/auth/session';
import { getParticipantProgramKind } from '@/lib/programmes/load';

export const metadata: Metadata = { title: 'Passeport Numérique' };

/** Parcours du participant inscrit au Passeport Numérique : l'application s'ouvre avec son compte. */
export default async function ParticipantPasseportNumeriquePage() {
  const user = await requireRole('participant');
  if (!user.participantId) redirect('/compte');
  if ((await getParticipantProgramKind(user.participantId)) !== 'passeport_numerique') redirect('/participant/dashboard');
  return <PasseportNumeriqueFrame />;
}
