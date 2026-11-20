import type { Metadata } from 'next';

import { GAMES_OUT_OF_REPORT_NOTICE, GameResultsView } from '@/components/jeux/results-view';
import { Notice, PageHeader } from '@/components/ui/primitives';
import { loadGameResults } from '@/lib/jeux/results-load';

import { getMyPassport } from '../data';

export const metadata: Metadata = { title: 'Mes jeux' };

const LIMIT = 200;

export default async function MyGamesPage() {
  const { passport, supabase } = await getMyPassport();
  const rows = await loadGameResults(supabase, passport.participant.id, LIMIT);
  return (
    <>
      <PageHeader
        title="Mes jeux"
        description="Vos résultats aux quiz et aux parties d’Undercover animés par votre formateur. Seuls vous, vos formateurs et l’équipe HAPPI les voient ; votre organisme n’y a pas accès."
      />
      <Notice className="mb-6" title="Hors bilan">
        {GAMES_OUT_OF_REPORT_NOTICE}
      </Notice>
      <GameResultsView rows={rows} truncated={rows.length >= LIMIT} />
    </>
  );
}
