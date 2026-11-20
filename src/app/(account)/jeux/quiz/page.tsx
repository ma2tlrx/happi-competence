import type { Metadata } from 'next';

import { QuizLibrary } from '@/components/jeux/quiz/quiz-library';
import { requireGamesAccess } from '@/lib/jeux/page-access';

export const metadata: Metadata = { title: 'Quiz en direct' };

export default async function QuizLibraryPage() {
  await requireGamesAccess();
  return <QuizLibrary />;
}
