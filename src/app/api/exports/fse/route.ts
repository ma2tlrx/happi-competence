import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { fseIndicatorsCsv, fseParticipantsCsv } from '@/lib/fse/csv';
import { canReadFse, loadFseFor } from '@/lib/fse/load';
import { parseImpactFilters } from '@/lib/outcomes/report';
import { createClient } from '@/lib/supabase/server';

/**
 * Exports CSV FSE+ : tableau agrégé (?type=indicateurs) ou fichier participants (?type=participants,
 * une ligne par parcours, entrée + sortie). Administrateur : tout ; organisme (permissions
 * org.entry_profile.manage et org.impact.read) : ses participants uniquement (RLS + filtre explicite).
 * Jamais un formateur. Chaque export est journalisé ; sans journal, pas d'export.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (user.status !== 'active' || !canReadFse(user)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const type = params.type === 'participants' ? 'participants' : 'indicateurs';
  const access = await loadFseFor(user, parseImpactFilters(params));
  if (!access) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  const supabase = await createClient();
  const { error } = await supabase.rpc('log_entry_profile_event', {
    p_action: type === 'participants' ? 'export.fse_participants_csv' : 'export.fse_indicators_csv',
    p_metadata: { filters: access.filters, rows: type === 'participants' ? access.report.journeys.length : access.report.total.summary.journeys },
  });
  if (error) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  const body = type === 'participants' ? fseParticipantsCsv(access.report.journeys) : fseIndicatorsCsv(access.report);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="fse-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
