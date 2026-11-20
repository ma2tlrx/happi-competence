'use client';

import { Gamepad2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/primitives';
import { EmptyState, Notice } from '@/components/ui/primitives';
import { quizAccessApi, type QuizSessionSummary } from '@/lib/jeux/client-undercover';
import { formatDateTime } from '@/lib/utils';

const STATUS: Record<QuizSessionSummary['status'], { label: string; variant: 'orange' | 'success' | 'neutral' }> = {
  waiting: { label: 'En attente', variant: 'orange' },
  active: { label: 'En cours', variant: 'success' },
  finished: { label: 'Terminée', variant: 'neutral' },
};

/** Parties de quiz récentes de l'animateur (les parties Undercover sont éphémères : effacées au bout de 24 h). */
export function RecentSessions() {
  const [sessions, setSessions] = useState<QuizSessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    quizAccessApi.recentSessions().then((result) => {
      if (off) return;
      if (result.ok) setSessions(result.data.sessions.slice(0, 8));
      else {
        setSessions([]);
        setError(result.error);
      }
    });
    return () => {
      off = true;
    };
  }, []);

  if (sessions === null) return <p className="px-5 py-6 text-sm text-ink-muted sm:px-6">Chargement des parties…</p>;
  if (error) {
    return (
      <div className="px-5 py-5 sm:px-6">
        <Notice variant="warning">Les parties récentes ne peuvent pas être affichées pour le moment. {error}</Notice>
      </div>
    );
  }
  if (sessions.length === 0) {
    return <EmptyState icon={Gamepad2} title="Aucune partie pour le moment" description="Vos parties de quiz apparaîtront ici dès que vous en aurez lancé une." className="py-10" />;
  }
  return (
    <ul className="divide-y divide-line">
      {sessions.map((session) => {
        const status = STATUS[session.status];
        return (
          <li key={session.id}>
            <Link href={`/jeux/quiz/partie/${session.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-petrol-50 sm:px-6">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{session.quiz?.title ?? 'Quiz'}</span>
                <span className="block text-sm text-ink-muted">
                  Code <span className="font-mono">{session.code}</span> · {formatDateTime(session.createdAt)}
                </span>
              </span>
              <Badge variant={status.variant}>{status.label}</Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
