import { MessageSquareHeart } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type { PendingSurvey } from '@/lib/satisfaction/load';
import { MOMENT_LABELS } from '@/lib/satisfaction/window';

/** Carte « Donnez votre avis » : enquêtes ouvertes et pas encore remplies. Rien si aucune. */
export function PendingSurveysCard({ surveys, basePath }: { surveys: PendingSurvey[]; basePath: '/participant/satisfaction' | '/organisme/satisfaction' }) {
  const pending = surveys.filter((survey) => !survey.answered);
  if (pending.length === 0) return null;
  return (
    <section aria-labelledby="avis-titre" className="rounded-lg border border-orange-200 bg-orange-50 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white text-orange-700">
          <MessageSquareHeart className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="avis-titre" className="font-display text-lg font-semibold text-ink">
            Donnez votre avis
          </h2>
          <p className="text-sm text-ink-muted">Quelques questions, deux minutes. Les réponses sont présentées de façon regroupée.</p>
          <ul className="mt-3 space-y-2">
            {pending.map((survey) => (
              <li key={`${survey.groupId}-${survey.moment}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white px-4 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{survey.groupName}</span>
                  <span className="block text-sm text-ink-muted">
                    {survey.programName} · enquête {MOMENT_LABELS[survey.moment].short} ({MOMENT_LABELS[survey.moment].description})
                  </span>
                </span>
                <Button asChild size="sm">
                  <Link href={`${basePath}?groupe=${survey.groupId}&moment=${survey.moment}`}>Répondre</Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
