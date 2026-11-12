import { MessageSquareQuote } from 'lucide-react';

import { Badge, Card, CardBody, CardHeader, ProvisionalBadge } from '@/components/ui/primitives';
import type { QuestionSummary, SatisfactionSummary } from '@/lib/satisfaction/aggregate';
import { AUDIENCE_LABELS, MOMENT_LABELS } from '@/lib/satisfaction/window';
import { formatScore } from '@/lib/utils';

function Distribution({ summary }: { summary: QuestionSummary }) {
  const total = summary.distribution.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return null;
  const compact = summary.question.kind === 'nps';
  return (
    <ul className={compact ? 'mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-11' : 'mt-3 space-y-1.5'} aria-label="Répartition des réponses">
      {summary.distribution.map((item) => {
        const share = total ? item.count / total : 0;
        return compact ? (
          <li key={item.key} className="rounded-md border border-line px-1 py-1.5 text-center">
            <span className="block text-xs text-ink-subtle">{item.label}</span>
            <span className="block font-semibold tabular-nums">{item.count}</span>
          </li>
        ) : (
          <li key={item.key} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
            <span className="truncate text-ink-muted" title={item.label}>
              {item.label}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-petrol-100" aria-hidden>
              <span className="block h-full rounded-full bg-petrol-700" style={{ width: `${share * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">
              {item.count} <span className="text-ink-subtle">({Math.round(share * 100)} %)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function QuestionResult({ summary, showAuthors, groupName }: { summary: QuestionSummary; showAuthors: boolean; groupName: (id: string) => string }) {
  const { question } = summary;
  const scaleMax = question.kind === 'nps' ? 10 : 5;
  return (
    <li className="py-4">
      <p className="font-medium text-ink">{question.text}</p>
      {question.kind === 'rating' || question.kind === 'nps' ? (
        <p className="mt-1 text-sm text-ink-muted">
          Moyenne <span className="font-semibold text-ink">{summary.mean === null ? '—' : `${formatScore(summary.mean)} / ${scaleMax}`}</span> · n = {summary.n}
          {question.kind === 'nps' && summary.recommendationIndex !== null ? (
            <>
              {' '}
              · indice de recommandation {summary.recommendationIndex > 0 ? '+' : ''}
              {summary.recommendationIndex} (part des 9–10 moins part des 0–6)
            </>
          ) : null}
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">n = {summary.n}</p>
      )}
      <Distribution summary={summary} />
      {question.kind === 'text' ? (
        summary.verbatims.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {summary.verbatims.map((verbatim, index) => (
              <li key={index} className="flex gap-2 rounded-md bg-paper px-3 py-2 text-[0.9375rem]">
                <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-petrol-400" aria-hidden />
                <span className="min-w-0">
                  « {verbatim.text} »
                  {showAuthors ? (
                    <span className="mt-0.5 block text-xs text-ink-subtle">
                      {verbatim.respondent ?? 'Auteur inconnu'} · {groupName(verbatim.groupId)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : summary.hiddenVerbatims === 0 ? (
          <p className="mt-2 text-sm text-ink-subtle">Aucun commentaire.</p>
        ) : null
      ) : null}
      {summary.hiddenVerbatims > 0 ? (
        <p className="mt-2 text-sm text-ink-subtle">
          {summary.hiddenVerbatims} commentaire{summary.hiddenVerbatims > 1 ? 's' : ''} non affiché{summary.hiddenVerbatims > 1 ? 's' : ''} : les commentaires ne sont
          restitués qu’à partir de 3 réponses par groupe, pour préserver l’anonymat.
        </p>
      ) : null}
    </li>
  );
}

/**
 * Résultats des enquêtes de satisfaction, par destinataire et par moment. Les données sont
 * déjà filtrées et anonymisées par la base ; seul l'administrateur reçoit l'auteur des verbatims.
 */
export function SatisfactionResults({
  summaries,
  showAuthors = false,
  groupNames = {},
  provisional = false,
}: {
  summaries: SatisfactionSummary[];
  showAuthors?: boolean;
  groupNames?: Record<string, string>;
  provisional?: boolean;
}) {
  const groupName = (id: string) => groupNames[id] ?? 'Groupe';
  const visible = summaries.filter((summary) => summary.responses > 0 || summary.groupsOpen > 0);
  if (visible.length === 0) {
    return (
      <p className="text-[0.9375rem] text-ink-muted">
        Aucune enquête ouverte ni réponse pour le moment. L’enquête à chaud s’ouvre à la fin de la dernière séance ; l’enquête à froid, 90 jours plus tard.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {visible.map((summary) => (
        <Card key={`${summary.audience}-${summary.moment}`}>
          <CardHeader
            as="h3"
            title={`${AUDIENCE_LABELS[summary.audience]} · ${MOMENT_LABELS[summary.moment].label.toLowerCase()}`}
            description={`${summary.responses} réponse${summary.responses > 1 ? 's' : ''} sur ${summary.invited} invité${summary.invited > 1 ? 's' : ''} · taux de réponse ${
              summary.rate === null ? '—' : `${Math.round(summary.rate * 100)} %`
            }`}
            action={
              <span className="flex flex-wrap gap-1.5">
                {summary.groupsOpen > 0 ? <Badge variant="success">Ouverte</Badge> : <Badge variant="outline">Fermée</Badge>}
                {provisional ? <ProvisionalBadge>Questions provisoires</ProvisionalBadge> : null}
              </span>
            }
          />
          <CardBody className="pt-1">
            {summary.questions.length > 0 ? (
              <ul className="divide-y divide-line">
                {summary.questions.map((question) => (
                  <QuestionResult key={question.question.id} summary={question} showAuthors={showAuthors} groupName={groupName} />
                ))}
              </ul>
            ) : (
              <p className="py-2 text-[0.9375rem] text-ink-muted">Aucune réponse pour le moment.</p>
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
