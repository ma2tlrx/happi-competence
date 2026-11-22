import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PasseportNumeriqueFrame } from '@/components/passeport-numerique/app-frame';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Passeport Numérique' };

/** Espace animateur du Passeport Numérique, ouvert sans code pour un formateur ou un administrateur. */
export default async function TrainerPasseportNumeriquePage() {
  await requireRole('formateur', 'admin');
  return (
    <>
      <Link href="/formateur/programmes?programme=passeport-numerique" className="mb-3 inline-flex min-h-8 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Programmes
      </Link>
      <PasseportNumeriqueFrame />
    </>
  );
}
