import { ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';

import { ImpactView } from '@/components/outcomes/impact-view';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { loadImpactFor, parseImpactFilters } from '@/lib/outcomes/report';

export const metadata: Metadata = { title: 'Impact' };

export default async function OrganizationImpactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole('organisme');
  const access = await loadImpactFor(user, parseImpactFilters(await searchParams));
  if (!access) {
    return (
      <Card>
        <EmptyState icon={ShieldAlert} title="Accès non ouvert" description="Votre compte ne permet pas de consulter le tableau de bord d’impact. Contactez l’équipe HAPPI." />
      </Card>
    );
  }
  return (
    <>
      <PageHeader
        title="Tableau de bord d’impact"
        description="Les parcours des participants rattachés à votre structure : abandons, assiduité, progression observée et situations de sortie. Chaque taux est donné avec son effectif (n)."
      />
      <ImpactView access={access} action="/organisme/impact" exportHref="/api/exports/impact" showOrganization={false} />
    </>
  );
}
