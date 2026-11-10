'use client';

import { AutosaveTextarea } from '@/components/ui/autosave-textarea';

import { saveLearningNote } from './actions';

export function LearningNote({ sessionId, initialValue }: { sessionId: string; initialValue: string }) {
  return (
    <AutosaveTextarea
      label="Ce que j’ai appris pendant cette session"
      placeholder="Une idée, une situation, une compétence que vous avez découverte…"
      initialValue={initialValue}
      rows={3}
      onSave={(learned) => saveLearningNote({ sessionId, learned })}
    />
  );
}
