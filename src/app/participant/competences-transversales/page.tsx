import type { Metadata } from 'next';

import { FrameworkView } from '@/components/passport/framework-view';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { frameworkOf } from '@/lib/passport';

import { getMyPassport } from '../data';

export const metadata: Metadata = { title: 'Mes compétences transversales' };

export default async function CompetencesTransversalesPage() {
  const { passport } = await getMyPassport();
  const framework = frameworkOf(passport, 'transversal');
  return (
    <>
      <PageHeader
        title="Mes compétences transversales"
        description="Ce que vos formateurs ont observé pendant les sessions, comparé à votre auto-évaluation de départ."
      />
      {framework ? <FrameworkView framework={framework} /> : <EmptyState title="Référentiel indisponible" description="Ce référentiel n’est pas encore activé pour votre programme." />}
    </>
  );
}
