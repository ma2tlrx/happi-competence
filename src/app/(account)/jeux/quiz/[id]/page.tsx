import type { Metadata } from 'next';

import { QuizEditor } from '@/components/jeux/quiz/quiz-editor';
import { requireGamesAccess } from '@/lib/jeux/page-access';

export const metadata: Metadata = { title: 'Éditeur de quiz' };

export default async function QuizEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGamesAccess();
  const { id } = await params;
  return <QuizEditor quizId={id} />;
}
