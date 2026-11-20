import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { QuizPlayer } from '@/components/jeux/quiz/quiz-player';
import { requirePlayer } from '@/lib/jeux/page-access';

export const metadata: Metadata = { title: 'Quiz en direct', robots: { index: false } };

/** Lobby puis jeu : participant connecté (ou animateur en essai). L'identité vient de la session ; `playerId` n'est pas un secret. */
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
  const { trial } = await requirePlayer(playerId ? `/jouer/quiz/${sessionId}?playerId=${encodeURIComponent(playerId)}` : '/jouer');
  if (!playerId) redirect('/jouer');
  return <QuizPlayer sessionId={sessionId} playerId={playerId} trial={trial} />;
}
