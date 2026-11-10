import { FileDown } from 'lucide-react';
import type { Metadata } from 'next';

import { BilanView } from '@/components/passport/bilan-view';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/primitives';

import { getMyPassport } from '../data';

export const metadata: Metadata = { title: 'Mon bilan' };

export default async function BilanPage() {
  const { passport } = await getMyPassport();
  return (
    <>
      <PageHeader
        title="Mon bilan"
        description="Une synthèse de ce que vos formateurs ont observé, à consulter et à présenter dans votre parcours professionnel."
        actions={
          <Button asChild>
            <a href={`/api/exports/passeport/${passport.participant.id}`} download>
              <FileDown aria-hidden />
              Télécharger mon passeport (PDF)
            </a>
          </Button>
        }
      />
      <BilanView passport={passport} />
    </>
  );
}
