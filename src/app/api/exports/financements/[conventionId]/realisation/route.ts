import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { realisationCsv } from '@/lib/funding/csv';
import { loadConvention, loadConventionReport } from '@/lib/funding/load';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';
import { isUuid } from '@/lib/utils';

/**
 * Réalisation par participant d'une convention (CSV nominatif). Administrateur uniquement ;
 * l'export est tracé dans le journal. Cellules protégées contre l'injection de formules.
 */
export async function GET(_: Request, { params }: { params: Promise<{ conventionId: string }> }) {
  const { conventionId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (user.role !== 'admin' || user.status !== 'active') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  if (!isUuid(conventionId)) return NextResponse.json({ error: 'Convention introuvable.' }, { status: 404 });
  const supabase = await createClient();
  const convention = await loadConvention(supabase, conventionId);
  if (!convention) return NextResponse.json({ error: 'Convention introuvable.' }, { status: 404 });
  const report = await loadConventionReport(supabase, convention, todayIso());
  const { error } = await supabase.rpc('log_funding_export', { p_document: 'realisation_csv', p_convention_id: convention.id });
  if (error) return NextResponse.json({ error: 'Export impossible : la traçabilité n’a pas pu être enregistrée.' }, { status: 500 });
  return new NextResponse(realisationCsv(convention, report), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="realisation-convention-${todayIso()}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
