import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { indicatorsCsv, participantsCsv } from '@/lib/outcomes/csv';
import { canReadImpact, loadImpactFor, parseImpactFilters } from '@/lib/outcomes/report';

/**
 * Export CSV du tableau de bord d'impact : indicateurs (?type=indicateurs) ou détail par parcours
 * (?type=participants). Administrateur : tout ; organisme (permission org.impact.read) : ses participants.
 * Cellules protégées contre l'injection de formules (voir src/lib/outcomes/csv.ts).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (user.status !== 'active' || !canReadImpact(user)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const type = params.type === 'participants' ? 'participants' : 'indicateurs';
  const access = await loadImpactFor(user, parseImpactFilters(params));
  if (!access) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  const body = type === 'participants' ? participantsCsv(access.report) : indicatorsCsv(access.report);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="impact-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
