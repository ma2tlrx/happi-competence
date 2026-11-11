import { FileDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import type { StoredReport } from '@/lib/report/load';
import { formatDate } from '@/lib/utils';

/** Bilans validés, téléchargeables par le participant et par son organisme (RLS : bilans validés uniquement). */
export function FinalReports({ reports, canDownload = true, title = 'Bilans HAPPI' }: { reports: StoredReport[]; canDownload?: boolean; title?: string }) {
  const finals = reports.filter((report) => report.status === 'final');
  if (finals.length === 0) return null;
  return (
    <Card className="mb-6">
      <CardHeader title={title} description="Bilans validés par l’équipe HAPPI : résultats observés, analyse et recommandations." />
      <CardBody>
        <ul className="divide-y divide-line">
          {finals.map((report) => (
            <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span>
                <span className="font-semibold">Bilan du {formatDate(report.finalizedAt)}</span>
                <span className="ml-2 text-sm text-ink-subtle">version {report.version}</span>
              </span>
              {canDownload ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/exports/bilan/${report.id}`} download>
                    <FileDown aria-hidden />
                    Télécharger (PDF)
                  </a>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
