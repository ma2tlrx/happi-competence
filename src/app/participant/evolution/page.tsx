import type { Metadata } from 'next';
import Link from 'next/link';

import { EvolutionView } from '@/components/passport/evolution-view';
import { Button } from '@/components/ui/button';
import { Notice, PageHeader } from '@/components/ui/primitives';
import { buildEvolution } from '@/lib/evolution';

import { getMyPassport } from '../data';

export const metadata: Metadata = { title: 'Mon évolution' };

export default async function EvolutionPage({ searchParams }: { searchParams: Promise<{ terminee?: string }> }) {
  const { terminee } = await searchParams;
  const { passport } = await getMyPassport();
  const evolution = buildEvolution(passport);
  return (
    <>
      <PageHeader
        title="Mon évolution"
        description="Ce que vous avez déclaré au départ, ce que vos formateurs ont observé pendant les séances, et ce que vous déclarez à la fin du parcours."
      />
      {terminee ? (
        <Notice variant="success" className="mb-5" title="Auto-évaluation de fin de parcours enregistrée">
          Merci. Vos réponses apparaissent maintenant dans la dernière colonne.
        </Notice>
      ) : null}
      {evolution.finalStatus === 'open' || evolution.finalStatus === 'in_progress' ? (
        <Notice
          className="mb-5"
          title="Votre auto-évaluation de fin de parcours est ouverte"
          action={
            <Button asChild size="sm">
              <Link href="/participant/auto-evaluation/finale">{evolution.finalStatus === 'open' ? 'Répondre' : 'Reprendre'}</Link>
            </Button>
          }
        >
          Les mêmes affirmations qu’au départ, pour voir comment votre regard a évolué. Une seule fois, environ cinq minutes.
        </Notice>
      ) : null}
      <EvolutionView evolution={evolution} />
    </>
  );
}
