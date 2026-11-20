import type { Metadata } from 'next';

import { QuizHostScreen } from '@/components/jeux/quiz/host-screen';
import { requireGamesAccess } from '@/lib/jeux/page-access';

export const metadata: Metadata = { title: 'Partie en direct' };

export default async function QuizHostPage({ params }: { params: Promise<{ sessionId: string }> }) {
  await requireGamesAccess();
  const { sessionId } = await params;
  return <QuizHostScreen sessionId={sessionId} />;
}
