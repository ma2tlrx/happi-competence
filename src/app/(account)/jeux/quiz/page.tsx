import type { Metadata } from 'next';

import { QuizLibrary } from '@/components/jeux/quiz/quiz-library';
import { requireGamesManager } from '@/lib/jeux/quiz-access';

export const metadata: Metadata = { title: 'Quiz en direct' };

export default async function QuizLibraryPage() {
  await requireGamesManager();
  return <QuizLibrary />;
}
