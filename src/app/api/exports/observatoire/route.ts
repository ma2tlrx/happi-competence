import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { toCsv } from '@/lib/csv';
import { parseObservatoryParams } from '@/lib/observatory/axes';
import { observatoryCsvLines } from '@/lib/observatory/csv';
import { canReadObservatory, loadObservatoryFor } from '@/lib/observatory/load';
import { createClient } from '@/lib/supabase/server';

/**
 * Export CSV de l'observatoire des compétences (administrateur uniquement), avec les filtres et l'axe
 * de comparaison de l'adresse. Tiré du même rapport masqué que la page : aucune case de moins de
 * 5 personnes, aucune donnée individuelle. Cellules protégées contre l'injection de formules (toCsv).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (!canReadObservatory(user)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  const { filters } = parseObservatoryParams(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const report = await loadObservatoryFor(user, filters);
  if (!report) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });

  // Action « export.observatory_csv » à ajouter à public.log_event (hors de ce chantier) : en attendant,
  // l'appel est refusé par la base sans bloquer le téléchargement.
  const supabase = await createClient();
  await supabase.rpc('log_event', {
    p_action: 'export.observatory_csv',
    p_entity_type: 'observatory',
    p_metadata: { framework: report.filters.framework, filters: Object.keys(report.filters.values), compare: report.filters.compare },
  });

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(observatoryCsvLines(report, today)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="observatoire-${report.filters.framework ?? 'competences'}-${today}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
