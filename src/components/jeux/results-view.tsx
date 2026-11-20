import { Gamepad2, Medal, Target, Timer, Trophy } from 'lucide-react';
import Link from 'next/link';

import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, StatTile, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { formatSeconds, GAME_LABELS, ROLE_LABELS, summarizeResults, type GameResultRow } from '@/lib/jeux/results';
import { formatDate } from '@/lib/utils';

export const GAMES_OUT_OF_REPORT_NOTICE =
  'Les jeux d’animation servent à animer les séances. Ces résultats ne comptent ni dans le bilan, ni dans le passeport, ni dans le CV de compétences, ni dans les indicateurs d’impact, ni dans les exports financeurs.';

function Indicators({ rows }: { rows: GameResultRow[] }) {
  const s = summarizeResults(rows);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Parties jouées" value={s.total} detail={`${s.quiz.games} quiz · ${s.undercover.games} Undercover`} icon={Gamepad2} />
      <StatTile
        label="Quiz : réponses justes"
        value={s.quiz.accuracy == null ? '—' : `${s.quiz.accuracy} %`}
        detail={s.quiz.bestScore == null ? 'Aucun quiz joué' : `Meilleur score : ${s.quiz.bestScore.toLocaleString('fr-FR')}`}
        icon={Target}
      />
      <StatTile
        label="Quiz : temps moyen"
        value={formatSeconds(s.quiz.avgResponseMs)}
        detail={s.quiz.games ? `${s.quiz.firstPlaces} première${s.quiz.firstPlaces > 1 ? 's' : ''} place${s.quiz.firstPlaces > 1 ? 's' : ''}` : undefined}
        icon={Timer}
      />
      <StatTile
        label="Undercover : parties gagnées"
        value={s.undercover.winRate == null ? '—' : `${s.undercover.winRate} %`}
        detail={s.undercover.games ? `${s.undercover.wins} sur ${s.undercover.games}` : 'Aucune partie jouée'}
        icon={Trophy}
      />
    </div>
  );
}

function Detail({ row }: { row: GameResultRow }) {
  if (row.game_type === 'quiz') {
    return (
      <>
        <span className="font-medium text-ink">{row.rank ? `${row.rank}${row.rank === 1 ? 'er' : 'e'} sur ${row.player_count}` : '—'}</span>
        <span className="block text-sm text-ink-subtle">
          {(row.score ?? 0).toLocaleString('fr-FR')} points
          {row.answered_count != null ? ` · ${row.correct_answers ?? 0} bonne${(row.correct_answers ?? 0) > 1 ? 's' : ''} réponse${(row.correct_answers ?? 0) > 1 ? 's' : ''} sur ${row.answered_count}` : ''}
          {row.avg_response_ms != null ? ` · ${formatSeconds(row.avg_response_ms)} en moyenne` : ''}
        </span>
      </>
    );
  }
  const role = ROLE_LABELS[row.role as keyof typeof ROLE_LABELS] ?? row.role ?? '—';
  return (
    <>
      <span className="font-medium text-ink">
        {role} · {row.outcome === 'won' ? 'gagné' : 'perdu'}
      </span>
      <span className="block text-sm text-ink-subtle">
        {row.player_count} joueurs · {row.rounds_survived ?? 0} manche{(row.rounds_survived ?? 0) > 1 ? 's' : ''} survécue{(row.rounds_survived ?? 0) > 1 ? 's' : ''}
      </span>
    </>
  );
}

function History({ rows }: { rows: GameResultRow[] }) {
  return (
    <TableWrap label="Historique des jeux">
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Jeu</Th>
            <Th>Partie</Th>
            <Th>Résultat</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td className="whitespace-nowrap">{formatDate(row.played_at)}</Td>
              <Td>
                <Badge variant={row.game_type === 'quiz' ? 'petrol' : 'orange'}>{GAME_LABELS[row.game_type as 'quiz' | 'undercover'] ?? row.game_type}</Badge>
              </Td>
              <Td className="text-sm">{row.title ?? '—'}</Td>
              <Td>
                <Detail row={row} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

/** Page « Mes jeux » : indicateurs puis historique. */
export function GameResultsView({ rows, truncated }: { rows: GameResultRow[]; truncated?: boolean }) {
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Gamepad2}
          title="Aucun jeu joué pour le moment"
          description="Quand vous participerez à un quiz ou à une partie d’Undercover animée par votre formateur, votre résultat apparaîtra ici."
        />
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <Indicators rows={rows} />
      <Card>
        <CardHeader title="Historique" description={truncated ? 'Les 200 parties les plus récentes.' : undefined} />
        <CardBody className="px-0 pb-2 sm:px-0">
          <History rows={rows} />
        </CardBody>
      </Card>
    </div>
  );
}

/** Section de la fiche participant (formateur, administrateur) : jeux hors bilan. */
export function GameResultsSection({ rows, participantName }: { rows: GameResultRow[]; participantName: string }) {
  return (
    <Card className="mt-6">
      <CardHeader
        title="Jeux d’animation (hors bilan)"
        description={`Résultats de ${participantName} aux quiz et parties d’Undercover animés en séance.`}
      />
      <CardBody className="space-y-4">
        <Notice>{GAMES_OUT_OF_REPORT_NOTICE}</Notice>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun jeu joué pour le moment.</p>
        ) : (
          <>
            <Indicators rows={rows} />
            <div className="-mx-5 sm:-mx-6">
              <History rows={rows.slice(0, 10)} />
            </div>
            {rows.length > 10 ? <p className="text-sm text-ink-subtle">Les 10 parties les plus récentes sur {rows.length}.</p> : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}

/** Carte récapitulative de la page de profil du participant. */
export function GameResultsSummaryCard({ rows, href }: { rows: GameResultRow[]; href: string }) {
  const s = summarizeResults(rows);
  return (
    <Card>
      <CardHeader title="Mes jeux" description="Quiz et Undercover joués en séance (hors bilan)." />
      <CardBody>
        {s.total === 0 ? (
          <p className="text-ink-muted">Aucun jeu joué pour le moment.</p>
        ) : (
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div>
              <dt className="text-sm text-ink-muted">Parties</dt>
              <dd className="font-display text-2xl font-semibold">{s.total}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Quiz juste</dt>
              <dd className="font-display text-2xl font-semibold">{s.quiz.accuracy == null ? '—' : `${s.quiz.accuracy} %`}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Undercover gagné</dt>
              <dd className="font-display text-2xl font-semibold">{s.undercover.winRate == null ? '—' : `${s.undercover.winRate} %`}</dd>
            </div>
          </dl>
        )}
        <p className="mt-4 text-sm">
          <Link href={href} className="inline-flex min-h-8 items-center gap-1.5 font-semibold text-petrol-700 underline-offset-2 hover:underline">
            <Medal className="size-4" aria-hidden />
            Voir mes jeux
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
