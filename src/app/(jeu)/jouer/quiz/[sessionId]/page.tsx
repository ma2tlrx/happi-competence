import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { QuizPlayer } from '@/components/jeux/quiz/quiz-player';

export const metadata: Metadata = { title: 'Quiz en direct', robots: { index: false } };

/** Page publique : lobby puis jeu, sans compte. L'identifiant du joueur vient de l'étape « code + pseudo ». */
export default async function PlayQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sessionId } = await params;
  const query = await searchParams;
  const playerId = typeof query.playerId === 'string' ? query.playerId : '';
  if (!playerId) redirect('/jouer');
  return <QuizPlayer sessionId={sessionId} playerId={playerId} />;
}
