import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ConventionDashboard } from '@/components/funding/convention-dashboard';
import { PageHeader } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { funderKindLabel } from '@/lib/funding/labels';
import { loadConventionReport, loadOrganizationConventions } from '@/lib/funding/load';
import { canReadImpact } from '@/lib/outcomes/report';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';
import { formatDate, isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'Convention de financement' };

/**
 * Réalisation d'une convention, vue de l'organisme : la convention doit figurer parmi celles que
 * la base lui ouvre (org_funding_conventions), et seuls ses participants sont comptés.
 */
export default async function OrganizationConventionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('organisme');
  const { id } = await params;
  if (!isUuid(id) || !canReadImpact(user) || !user.organization) notFound();
  const supabase = await createClient();
  const convention = (await loadOrganizationConventions(supabase)).find((row) => row.id === id);
  if (!convention) notFound();
  const report = await loadConventionReport(supabase, convention, todayIso(), { organizationId: user.organization.id });

  return (
    <>
      <PageHeader
        back={
          <Link href="/organisme/financements" className="inline-flex min-h-8 items-center gap-1 font-semibold text-petrol-700 underline">
            <ArrowLeft className="size-4" aria-hidden />
            Financements
          </Link>
        }
        title={convention.title}
        description={`${convention.funderName} (${funderKindLabel(convention.funderKind)}) · ${convention.reference ?? 'référence non renseignée'} · du ${formatDate(convention.startDate)} au ${formatDate(convention.endDate)}`}
      />
      <ConventionDashboard
        report={report}
        plannedHours={convention.plannedHours}
        showSatisfaction={false}
        scopeNotice={`Seuls les participants rattachés à ${user.organization.name} sont comptés : les effectifs conventionnés (${convention.plannedParticipants}) portent sur l’ensemble de l’action, les autres chiffres sur vos participants.`}
        unavailable={{ attendance: !hasPermission(user, 'org.attendance.read'), progression: !hasPermission(user, 'org.evaluations.read') }}
      />
    </>
  );
}
