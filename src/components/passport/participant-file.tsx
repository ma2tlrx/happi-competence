import { FileDown, FileText } from 'lucide-react';

import { BilanView } from '@/components/passport/bilan-view';
import { FrameworkView } from '@/components/passport/framework-view';
import { AttendanceBadge, SessionStatusBadge } from '@/components/passport/session-status';
import { Button } from '@/components/ui/button';
import { LevelMeter, SessionSteps } from '@/components/ui/level-meter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Avatar, Badge, Card, CardBody, CardHeader, EmptyState, StatTile } from '@/components/ui/primitives';
import type { Passport } from '@/lib/passport';
import { formatDate, formatDateTime } from '@/lib/utils';

/**
 * Fiche individuelle de compétences d'un participant, vue par un professionnel
 * (formateur, organisme, administrateur). Les données ont déjà été filtrées par RLS.
 */
export function ParticipantFile({
  passport,
  back,
  canDownload = true,
  reportHref,
}: {
  passport: Passport;
  back?: React.ReactNode;
  canDownload?: boolean;
  /** Lien vers l'espace « Bilan HAPPI » (équipe pédagogique uniquement). */
  reportHref?: string;
}) {
  const { participant, group } = passport;
  const self = passport.selfAssessment;
  const total = group?.sessionsCount ?? 6;
  return (
    <>
      <header className="mb-6">
        {back ? <div className="mb-2 text-sm">{back}</div> : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar person={{ first_name: participant.firstName, last_name: participant.lastName }} size="lg" />
            <div>
              <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.02em]">
                {participant.firstName} {participant.lastName}
              </h1>
              <p className="text-ink-muted">
                {[participant.organization?.name ?? 'Sans organisme', group?.name].filter(Boolean).join(' · ')}
                {participant.hasAccount ? '' : ' · compte non créé'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
          {reportHref ? (
            <Button asChild>
              <a href={reportHref}>
                <FileText aria-hidden />
                Bilan HAPPI
              </a>
            </Button>
          ) : null}
          {canDownload ? (
            <Button asChild variant="outline">
              <a href={`/api/exports/passeport/${participant.id}`} download>
                <FileDown aria-hidden />
                Fiche de compétences (PDF)
              </a>
            </Button>
          ) : null}
          </div>
        </div>
      </header>

      <Tabs defaultValue="synthese">
        <TabsList aria-label="Rubriques de la fiche">
          <TabsTrigger value="synthese">Synthèse</TabsTrigger>
          <TabsTrigger value="auto">Auto-évaluation</TabsTrigger>
          {passport.frameworks.map((framework) => (
            <TabsTrigger key={framework.code} value={framework.code}>
              {framework.name}
            </TabsTrigger>
          ))}
          <TabsTrigger value="evaluations">Évaluations</TabsTrigger>
          <TabsTrigger value="bilan">Bilan</TabsTrigger>
        </TabsList>

        <TabsContent value="synthese" className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile label="Sessions réalisées" value={`${passport.completedSessions}/${total}`} />
            <StatTile label="Sessions suivies" value={passport.attendedSessions} detail={passport.completedSessions ? `${Math.round((passport.attendedSessions / passport.completedSessions) * 100)} % de présence` : undefined} />
            {passport.frameworks.map((framework) => (
              <StatTile key={framework.code} label={`${framework.shortName} observées`} value={`${framework.observedCount}/${framework.skills.length}`} />
            ))}
          </div>
          <Card>
            <CardHeader title="Parcours" description={group ? `${group.programName} · ${formatDate(group.startDate, '—')} – ${formatDate(group.endDate, '…')}` : 'Pas encore inscrit dans un groupe'} />
            <CardBody>
              <SessionSteps total={total} completed={passport.completedSessions} current={(passport.currentSession ?? passport.nextSession)?.number} />
              <ul className="mt-5 divide-y divide-line">
                {passport.sessions.map((session) => (
                  <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[0.9375rem]">
                    <span>
                      <span className="font-medium">Session {session.number} · {session.title}</span>
                      <span className="ml-2 text-sm text-ink-subtle">{formatDate(session.date)}</span>
                    </span>
                    <span className="flex gap-1.5">
                      <SessionStatusBadge status={session.status} />
                      {session.status === 'completed' ? <AttendanceBadge status={session.attendance} /> : null}
                      {session.evaluated ? <Badge variant="petrol">Évalué</Badge> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="auto">
          <Card>
            {self?.status === 'completed' ? (
              <>
                <CardHeader title="Auto-évaluation initiale" description={`Complétée le ${formatDateTime(self.completedAt)} · ${self.scaleLabels.map((l) => `${l.value} = ${l.label}`).join(' · ')}`} />
                <CardBody>
                  <ol className="divide-y divide-line">
                    {self.answers.map((answer, index) => (
                      <li key={answer.questionId} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center">
                        <p className="text-[0.9375rem]">
                          <span className="mr-2 text-ink-subtle">{index + 1}.</span>
                          {answer.text}
                        </p>
                        <div className="flex items-center gap-3">
                          <LevelMeter value={answer.value} min={self.scaleMin} max={self.scaleMax} tone="self" size="sm" label={`Réponse ${answer.value} sur ${self.scaleMax}`} />
                          <span className="w-4 text-sm font-semibold tabular-nums">{answer.value}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {self.comment ? <p className="mt-4 rounded-md bg-paper p-3 text-[0.9375rem] text-ink-muted">« {self.comment} »</p> : null}
                </CardBody>
              </>
            ) : (
              <EmptyState title="Auto-évaluation non réalisée" description={participant.hasAccount ? 'Le participant n’a pas encore répondu au questionnaire.' : 'Le participant répondra au questionnaire en créant son compte.'} />
            )}
          </Card>
        </TabsContent>

        {passport.frameworks.map((framework) => (
          <TabsContent key={framework.code} value={framework.code}>
            <FrameworkView framework={framework} subRadars={framework.code === 'sociocognitive'} audience="pro" />
          </TabsContent>
        ))}

        <TabsContent value="evaluations">
          <Card>
            {passport.evaluations.length > 0 ? (
              <ul className="divide-y divide-line">
                {passport.evaluations.map((evaluation) => (
                  <li key={evaluation.id} className="px-5 py-4 sm:px-6">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      Session {evaluation.sessionNumber} · {evaluation.sessionTitle}
                      {evaluation.revision > 0 ? <Badge variant="outline">{evaluation.revision} modification(s) tracée(s)</Badge> : null}
                    </p>
                    <p className="text-sm text-ink-subtle">
                      Validée le {formatDateTime(evaluation.validatedAt)}
                      {evaluation.evaluator ? ` par ${evaluation.evaluator}` : ''} · {evaluation.scoreCount} compétence(s) notée(s)
                    </p>
                    {evaluation.observation ? <p className="mt-2 text-[0.9375rem]">{evaluation.observation}</p> : null}
                    {evaluation.advice ? <p className="mt-1 text-[0.9375rem] text-ink-muted"><span className="font-semibold text-ink">Conseil : </span>{evaluation.advice}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Aucune évaluation validée" description="Les évaluations apparaissent ici une fois validées par le formateur." />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="bilan">
          <BilanView passport={passport} audience="pro" />
        </TabsContent>
      </Tabs>
    </>
  );
}
