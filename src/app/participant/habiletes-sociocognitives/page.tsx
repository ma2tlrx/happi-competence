import type { Metadata } from 'next';

import { FrameworkView } from '@/components/passport/framework-view';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { frameworkOf } from '@/lib/passport';

import { getMyPassport } from '../data';

export const metadata: Metadata = { title: 'Mes habiletés socio-cognitives' };

export default async function HabiletesPage() {
  const { passport } = await getMyPassport();
  const framework = frameworkOf(passport, 'sociocognitive');
  return (
    <>
      <PageHeader
        title="Mes habiletés socio-cognitives"
        description="Les aptitudes qui vous permettent d’apprendre, d’interagir et de vous adapter, organisées en cinq dimensions."
      />
      {framework ? <FrameworkView framework={framework} subRadars /> : <EmptyState title="Référentiel indisponible" description="Ce référentiel n’est pas encore activé pour votre programme." />}
    </>
  );
}
