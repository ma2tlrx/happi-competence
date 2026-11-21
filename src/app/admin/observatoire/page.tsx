import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ObservatoryView } from '@/components/observatory/observatory-view';
import { requireRole } from '@/lib/auth/session';
import { parseObservatoryParams } from '@/lib/observatory/axes';
import { loadObservatoryFor } from '@/lib/observatory/load';

export const metadata: Metadata = { title: 'Observatoire des compétences' };

/**
 * Observatoire des compétences (administration) : résultats observés de tous les participants,
 * compétence par compétence, avec filtres et comparaison. Seul un rapport agrégé et masqué
 * (src/lib/observatory/report.ts) est transmis au navigateur.
 */
export default async function ObservatoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole('admin');
  const { filters, skill } = parseObservatoryParams(await searchParams);
  const report = await loadObservatoryFor(user, filters);
  if (!report) redirect('/admin/dashboard');
  return <ObservatoryView report={report} initialSkill={skill} />;
}
