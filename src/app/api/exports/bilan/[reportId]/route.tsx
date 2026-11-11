import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/auth/session';
import { ReportDocument } from '@/lib/pdf/report/report-document';
import { getReport } from '@/lib/report/load';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * Bilan en PDF, rendu à partir de la version enregistrée (résultats figés et texte
 * de la version) : un ancien bilan se télécharge toujours à l'identique.
 * Accès : RLS — brouillons pour l'équipe du participant, bilans validés pour le
 * participant et son organisme.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (!isUuid(reportId)) return NextResponse.json({ error: 'Bilan introuvable.' }, { status: 404 });
  if (user.role === 'organisme' && !hasPermission(user, 'org.exports')) {
    return NextResponse.json({ error: 'Téléchargement non autorisé pour ce compte.' }, { status: 403 });
  }
  const supabase = await createClient();
  const report = await getReport(supabase, reportId);
  if (!report) return NextResponse.json({ error: 'Bilan introuvable.' }, { status: 404 });

  const buffer = await renderToBuffer(
    <ReportDocument
      data={report.data}
      content={report.content}
      options={report.options}
      meta={{ version: report.version, status: report.status, finalizedAt: report.finalizedAt, contentSource: report.contentSource }}
    />,
  );
  await supabase.rpc('log_event', {
    p_action: 'export.report_pdf',
    p_entity_type: 'participant',
    p_entity_id: report.participantId,
    p_metadata: { report_id: report.id, version: report.version },
  });
  const slug = `${report.data.participant.firstName}-${report.data.participant.lastName}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .toLowerCase();
  const inline = request.nextUrl.searchParams.get('apercu') === '1';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="bilan-happi-${slug}-v${report.version}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
