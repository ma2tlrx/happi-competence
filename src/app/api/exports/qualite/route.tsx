import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { QualityEvidenceDocument } from '@/lib/pdf/quality-evidence-document';
import { actionsInPeriod, inPeriod } from '@/lib/quality/indicators';
import { loadComplaints, loadImprovementActions, loadQualityDashboard, loadTrainerRegistry, loadWatchEntries, parsePeriod } from '@/lib/quality/load';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';

export const runtime = 'nodejs';

/**
 * Dossier de preuves qualité (PDF) pour une période (?du=…&au=…). Administrateur uniquement :
 * les registres ne sont lisibles que par lui (RLS), et l'export est tracé dans le journal.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (user.role !== 'admin' || user.status !== 'active') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  const today = todayIso();
  const period = parsePeriod(Object.fromEntries(request.nextUrl.searchParams.entries()), today);
  const supabase = await createClient();
  const [dashboard, complaints, actions, watch] = await Promise.all([
    loadQualityDashboard(supabase, period, today),
    loadComplaints(supabase, period),
    loadImprovementActions(supabase),
    loadWatchEntries(supabase),
  ]);
  const registry = await loadTrainerRegistry(supabase, today, dashboard.trainers.maxAgeMonths);
  const buffer = await renderToBuffer(
    <QualityEvidenceDocument
      evidence={{ dashboard, complaints, actions: actionsInPeriod(actions, period), watch: watch.filter((entry) => inPeriod(entry.observedOn, period)), registry }}
      generatedAt={new Date()}
    />,
  );
  await supabase.rpc('log_quality_export', { p_from: period.from, p_to: period.to });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dossier-preuves-qualite-${period.from}-${period.to}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
