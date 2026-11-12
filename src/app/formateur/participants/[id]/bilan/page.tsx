import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { EvolutionView } from '@/components/passport/evolution-view';
import { ReportWorkspace } from '@/components/report/report-workspace';
import { PageHeader } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { buildEvolution } from '@/lib/evolution';
import { getPassport } from '@/lib/passport';
import { isAiConfigured } from '@/lib/report/ai';
import { listReports } from '@/lib/report/load';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'Bilan HAPPI' };
// La génération (photographie + rédaction) peut durer jusqu'à deux minutes.
export const maxDuration = 300;

export default async function ParticipantReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  const { id } = await params;
  const { version } = await searchParams;
  if (!isUuid(id)) notFound();
  await requireRole('formateur', 'admin');
  const supabase = await createClient();
  const { data: participant } = await supabase.from('participants').select('id, first_name, last_name').eq('id', id).maybeSingle();
  if (!participant) notFound();
  const [reports, passport] = await Promise.all([listReports(supabase, id), getPassport(supabase, id)]);
  const selected = reports.find((report) => report.id === version) ?? reports[0] ?? null;
  const name = `${participant.first_name} ${participant.last_name}`;
  return (
    <>
      <PageHeader
        back={
          <Link href={`/formateur/participants/${id}`} className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            Fiche de {name}
          </Link>
        }
        title={`Bilan HAPPI · ${name}`}
        description="Un bilan professionnel à remettre au participant ou à sa structure : résultats validés, analyse rédigée, recommandations et méthodologie."
      />
      <ReportWorkspace
        participant={{ id, name }}
        reports={reports.map(({ id: reportId, version: number, status, contentSource, createdAt, finalizedAt }) => ({
          id: reportId,
          version: number,
          status,
          contentSource,
          createdAt,
          finalizedAt,
        }))}
        selected={selected}
        aiReady={isAiConfigured()}
      />
      {passport ? (
        <details className="mt-8 rounded-lg border border-line bg-white">
          <summary className="flex min-h-11 cursor-pointer items-center px-5 py-3 font-semibold sm:px-6">
            Évolution : déclaré au départ, observé, déclaré à la fin
          </summary>
          <div className="border-t border-line p-4 sm:p-6">
            <p className="mb-4 text-sm text-ink-muted">
              Données en direct du passeport, présentées pour préparer le bilan. Elles ne font pas partie de la photographie figée du bilan.
            </p>
            <EvolutionView evolution={buildEvolution(passport)} audience="pro" />
          </div>
        </details>
      ) : null}
    </>
  );
}
