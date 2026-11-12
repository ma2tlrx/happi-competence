import { FileDown, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { writingMention } from '@/lib/report/ai-disclosure';
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
                {/* Transparence sur l'usage de l'IA (règlement européen sur l'IA, art. 50). */}
                {writingMention(report.contentSource) ? (
                  <span className="mt-0.5 flex items-start gap-1.5 text-sm text-ink-muted">
                    {report.contentSource === 'manual' ? null : <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                    {writingMention(report.contentSource)}
                  </span>
                ) : null}
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
