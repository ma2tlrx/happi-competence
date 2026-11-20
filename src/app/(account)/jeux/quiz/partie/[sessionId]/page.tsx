import type { Metadata } from 'next';

import { QuizHostScreen } from '@/components/jeux/quiz/host-screen';
import { requireGamesManager } from '@/lib/jeux/quiz-access';

export const metadata: Metadata = { title: 'Partie en direct' };

export default async function QuizHostPage({ params }: { params: Promise<{ sessionId: string }> }) {
  await requireGamesManager();
  const { sessionId } = await params;
  return <QuizHostScreen sessionId={sessionId} />;
}
