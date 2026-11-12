import { FileDown, Share2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BilanView } from '@/components/passport/bilan-view';
import { FinalReports } from '@/components/report/final-reports';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/primitives';
import { listReports } from '@/lib/report/load';
import { createClient } from '@/lib/supabase/server';

import { getMyPassport } from '../data';

export const metadata: Metadata = { title: 'Mon bilan' };

export default async function BilanPage() {
  const { passport } = await getMyPassport();
  const reports = await listReports(await createClient(), passport.participant.id);
  return (
    <>
      <PageHeader
        title="Mon bilan"
        description="Une synthèse de ce que vos formateurs ont observé, à consulter et à présenter dans votre parcours professionnel."
        actions={
          <>
          <Button asChild variant="outline">
            <Link href="/participant/partage">
              <Share2 aria-hidden />
              Partager mon passeport
            </Link>
          </Button>
          <Button asChild>
            <a href={`/api/exports/passeport/${passport.participant.id}`} download>
              <FileDown aria-hidden />
              Télécharger mon passeport (PDF)
            </a>
          </Button>
          </>
        }
      />
      <FinalReports reports={reports} title="Mes bilans HAPPI" />
      <BilanView passport={passport} />
    </>
  );
}
