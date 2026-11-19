import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { bpfCsv } from '@/lib/funding/csv';
import { loadBpf } from '@/lib/funding/load';
import { parseYear } from '@/lib/funding/schemas';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';

/**
 * Données du bilan pédagogique et financier pour une année civile (?annee=AAAA), en CSV.
 * Administrateur uniquement ; données agrégées, export tracé dans le journal.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (user.role !== 'admin' || user.status !== 'active') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  const year = parseYear(request.nextUrl.searchParams.get('annee'), Number(todayIso().slice(0, 4)) - 1);
  const supabase = await createClient();
  const report = await loadBpf(supabase, year);
  const { error } = await supabase.rpc('log_funding_export', { p_document: 'bpf_csv', p_year: year });
  if (error) return NextResponse.json({ error: 'Export impossible : la traçabilité n’a pas pu être enregistrée.' }, { status: 500 });
  return new NextResponse(bpfCsv(report), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bpf-donnees-${year}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
