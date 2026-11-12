import type { Metadata } from 'next';

import { SatisfactionSurveyPage } from '@/components/satisfaction/survey-page';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Donnez votre avis' };

export default async function ParticipantSatisfactionPage({ searchParams }: { searchParams: Promise<{ groupe?: string; moment?: string; merci?: string }> }) {
  await requireRole('participant');
  const params = await searchParams;
  const supabase = await createClient();
  return (
    <SatisfactionSurveyPage
      supabase={supabase}
      basePath="/participant/satisfaction"
      params={params}
      audienceText="Votre avis sur le programme, à la fin du parcours puis trois mois après. Les formateurs et votre structure ne voient que des résultats regroupés, jamais votre nom."
    />
  );
}
