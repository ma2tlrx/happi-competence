import { ArrowLeft, Download, FileText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ConventionDashboard } from '@/components/funding/convention-dashboard';
import { DeleteButton, RecordDialog } from '@/components/quality/record-dialog';
import { buttonClasses } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, Notice, PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { attachGroup, detachGroup, saveConvention } from '@/lib/funding/actions';
import { conventionFields } from '@/lib/funding/forms';
import { conventionStatusLabel, FUNDING_REPORT_NOTICE, funderKindLabel } from '@/lib/funding/labels';
import { loadConvention, loadConventionReport, loadFunders, loadGroupOptions } from '@/lib/funding/load';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';
import { formatDate, isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'Convention de financement' };

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export default async function ConventionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const convention = await loadConvention(supabase, id);
  if (!convention) notFound();
  const [report, funders, groups] = await Promise.all([loadConventionReport(supabase, convention, todayIso()), loadFunders(supabase), loadGroupOptions(supabase)]);
  const attached = groups.filter((group) => group.conventionId === convention.id);
  const available = groups.filter((group) => group.conventionId === null);
  const exportBase = `/api/exports/financements/${convention.id}`;

  return (
    <>
      <PageHeader
        back={
          <Link href="/admin/financements" className="inline-flex min-h-8 items-center gap-1 font-semibold text-petrol-700 underline">
            <ArrowLeft className="size-4" aria-hidden />
            Conventions
          </Link>
        }
        title={convention.title}
        description={`${convention.funderName} (${funderKindLabel(convention.funderKind)}) · ${convention.reference ?? 'référence non renseignée'} · du ${formatDate(convention.startDate)} au ${formatDate(convention.endDate)}`}
        actions={
          <RecordDialog
            mode="edit"
            triggerLabel="Modifier"
            ariaLabel="Modifier la convention"
            title="Convention"
            fields={conventionFields(funders, convention)}
            action={saveConvention.bind(null, convention.id)}
          />
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant="petrol">{conventionStatusLabel(convention.status)}</Badge>
        {convention.isDemo ? <Badge variant="orange">Démo</Badge> : null}
        <span className="text-sm text-ink-muted">
          {`${convention.plannedParticipants} participants × ${String(convention.plannedHours).replace('.', ',')} h`}
          {convention.amount !== null ? ` · ${euros.format(convention.amount)}` : ''}
        </span>
      </div>

      <Card className="mb-6">
        <CardHeader title="Documents pour le financeur" description={FUNDING_REPORT_NOTICE} />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            <a href={`${exportBase}/bilan`} className={buttonClasses({ variant: 'secondary' })}>
              <FileText aria-hidden />
              Bilan de l’action (PDF)
            </a>
            <a href={`${exportBase}/realisation`} className={buttonClasses({ variant: 'outline' })}>
              <Download aria-hidden />
              Réalisation par participant (CSV)
            </a>
            <a href={`${exportBase}/bilan?nominatif=1`} className={buttonClasses({ variant: 'outline' })}>
              <FileText aria-hidden />
              Bilan avec annexe nominative (PDF)
            </a>
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            Le bilan contient des données agrégées. L’annexe nominative (nom, heures réalisées, situation de sortie) et le CSV sont des données
            personnelles : ne les transmettez qu’au financeur qui les exige. Chaque téléchargement est tracé dans le journal d’activité.
          </p>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader
          title="Groupes rattachés"
          description="Un groupe ne peut relever que d’une seule convention."
          action={
            available.length ? (
              <RecordDialog
                mode="create"
                triggerLabel="Rattacher un groupe"
                title="Rattacher un groupe"
                size="md"
                fields={[
                  {
                    name: 'groupId',
                    label: 'Groupe',
                    kind: 'select',
                    required: true,
                    options: available.map((group) => ({
                      value: group.id,
                      label: `${group.name} (${formatDate(group.startDate, 'dates à définir')})`,
                    })),
                  },
                ]}
                action={attachGroup.bind(null, convention.id)}
              />
            ) : null
          }
        />
        <CardBody>
          {attached.length ? (
            <ul className="divide-y divide-line">
              {attached.map((group) => {
                const outside = (group.startDate && group.startDate > convention.endDate) || (group.endDate && group.endDate < convention.startDate);
                return (
                  <li key={group.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{group.name}</p>
                      <p className="text-sm text-ink-muted">
                        {`${formatDate(group.startDate, '—')} → ${formatDate(group.endDate, '—')}`}
                        {outside ? <span className="ml-2 font-semibold text-warning">Hors période de la convention</span> : null}
                      </p>
                    </div>
                    <DeleteButton
                      action={detachGroup.bind(null, convention.id, group.id)}
                      label={`Détacher le groupe « ${group.name} »`}
                      confirm="Détacher ce groupe de la convention ? Le groupe et ses données sont conservés."
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <Notice>Aucun groupe rattaché : le tableau de bord se remplira dès qu’un groupe sera rattaché.</Notice>
          )}
        </CardBody>
      </Card>

      <ConventionDashboard report={report} plannedHours={convention.plannedHours} showCertificates />
    </>
  );
}
