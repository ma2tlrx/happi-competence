import type { Metadata } from 'next';

import { ImpactTabs } from '@/components/fse/impact-tabs';
import { FseView } from '@/components/fse/fse-view';
import { PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { loadFseFor } from '@/lib/fse/load';
import { parseImpactFilters } from '@/lib/outcomes/report';

export const metadata: Metadata = { title: 'Indicateurs FSE+' };

export default async function AdminFsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole('admin');
  const access = await loadFseFor(user, parseImpactFilters(await searchParams));
  return (
    <>
      <PageHeader
        title="Tableau de bord d’impact"
        description="Indicateurs communs du FSE+ (règlement (UE) 2021/1057, annexe I) et des dispositifs publics, à partir des fiches d’entrée et des situations de sortie."
      />
      <ImpactTabs />
      {access ? <FseView access={access} action="/admin/impact/fse" exportHref="/api/exports/fse" detailHref={(id) => `/admin/impact/fse/${id}`} /> : null}
    </>
  );
}
