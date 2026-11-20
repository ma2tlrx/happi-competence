import type { Metadata } from 'next';

import { QuizEditor } from '@/components/jeux/quiz/quiz-editor';
import { requireGamesManager } from '@/lib/jeux/quiz-access';

export const metadata: Metadata = { title: 'Éditeur de quiz' };

export default async function QuizEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGamesManager();
  const { id } = await params;
  return <QuizEditor quizId={id} />;
}
