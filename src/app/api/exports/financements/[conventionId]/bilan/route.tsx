import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { loadConvention, loadConventionReport } from '@/lib/funding/load';
import { FundingReportDocument } from '@/lib/pdf/funding-report-document';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';
import { isUuid } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * Bilan de l'action d'une convention (PDF). Administrateur uniquement (les conventions ne sont
 * lisibles que par lui, RLS). Données agrégées ; l'annexe nominative n'est ajoutée qu'avec
 * ?nominatif=1, choix explicite tracé dans le journal.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ conventionId: string }> }) {
  const { conventionId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (user.role !== 'admin' || user.status !== 'active') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  if (!isUuid(conventionId)) return NextResponse.json({ error: 'Convention introuvable.' }, { status: 404 });
  const nominative = request.nextUrl.searchParams.get('nominatif') === '1';
  const supabase = await createClient();
  const convention = await loadConvention(supabase, conventionId);
  if (!convention) return NextResponse.json({ error: 'Convention introuvable.' }, { status: 404 });
  const report = await loadConventionReport(supabase, convention, todayIso());
  const buffer = await renderToBuffer(<FundingReportDocument convention={convention} report={report} nominative={nominative} generatedAt={new Date()} />);
  const { error } = await supabase.rpc('log_funding_export', {
    p_document: nominative ? 'bilan_action_pdf_nominatif' : 'bilan_action_pdf',
    p_convention_id: convention.id,
  });
  if (error) return NextResponse.json({ error: 'Export impossible : la traçabilité n’a pas pu être enregistrée.' }, { status: 500 });
  const slug = (convention.reference ?? convention.title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .toLowerCase()
    .slice(0, 60);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bilan-action-${slug}${nominative ? '-nominatif' : ''}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
