import type { Metadata } from 'next';

import { ImpactView } from '@/components/outcomes/impact-view';
import { PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { loadImpactFor, parseImpactFilters } from '@/lib/outcomes/report';

export const metadata: Metadata = { title: 'Impact' };

export default async function AdminImpactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole('admin');
  const access = await loadImpactFor(user, parseImpactFilters(await searchParams));
  return (
    <>
      <PageHeader
        title="Tableau de bord d’impact"
        description="Inscriptions, abandons, assiduité, progression observée et situations de sortie, par cohorte et par organisme. Chaque taux est donné avec son effectif (n)."
      />
      {access ? <ImpactView access={access} action="/admin/impact" exportHref="/api/exports/impact" showOrganization /> : null}
    </>
  );
}
