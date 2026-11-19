import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/auth/session';
import { toCsv } from '@/lib/csv';
import { getPassport } from '@/lib/passport';
import { resultsCsvLines } from '@/lib/public-frameworks/results-csv';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

/**
 * Résultats d'un participant au format CSV, pour un conseiller : une ligne par compétence,
 * avec les correspondances VALIDÉES vers les référentiels publics (source et version).
 * L'accès est celui de la fiche : RLS ne renvoie le participant qu'à lui-même, à ses
 * formateurs, à son organisme et aux administrateurs ; un organisme doit en outre
 * disposer de la permission d'export.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  if (!isUuid(participantId)) return NextResponse.json({ error: 'Participant introuvable.' }, { status: 404 });
  if (user.role === 'organisme' && !hasPermission(user, 'org.exports')) {
    return NextResponse.json({ error: 'Téléchargement non autorisé pour ce compte.' }, { status: 403 });
  }

  const supabase = await createClient();
  const passport = await getPassport(supabase, participantId);
  if (!passport) return NextResponse.json({ error: 'Participant introuvable.' }, { status: 404 });

  // Action « export.results_csv » à ajouter à public.log_event (hors de ce chantier) : en attendant,
  // l'appel est refusé par la base sans bloquer le téléchargement.
  await supabase.rpc('log_event', { p_action: 'export.results_csv', p_entity_type: 'participant', p_entity_id: participantId });

  const slug = `${passport.participant.firstName}-${passport.participant.lastName}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .toLowerCase();
  return new NextResponse(toCsv(resultsCsvLines(passport)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="resultats-happi-${slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
