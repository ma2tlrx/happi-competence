import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { loadReliabilityDataset } from '@/lib/reliability/load';
import { pairRatings } from '@/lib/reliability/report';
import { readSalt, researchCsv } from '@/lib/reliability/research-export';
import { createClient } from '@/lib/supabase/server';

/**
 * Export CSV pseudonymisé des paires de cotations, pour un partenaire de recherche.
 * Administrateur uniquement ; refusé tant que le sel (RELIABILITY_PSEUDONYM_SALT) n'est pas défini.
 * Données de démonstration exclues sauf ?demo=1. Chaque export est journalisé.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (user.status !== 'active' || user.role !== 'admin') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  const salt = readSalt();
  if (!salt) return NextResponse.json({ error: 'Export désactivé : sel de pseudonymisation non configuré.' }, { status: 503 });
  const includeDemo = request.nextUrl.searchParams.get('demo') === '1';
  const supabase = await createClient();
  const dataset = await loadReliabilityDataset(supabase, { includeDemo });
  const { records } = pairRatings(dataset);
  const { error } = await supabase.rpc('log_reliability_export', { p_rows: records.length, p_include_demo: includeDemo });
  if (error) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  return new NextResponse(researchCsv(records, dataset.versions, dataset.skills, salt), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="fiabilite-paires-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
