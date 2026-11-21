import { CalendarDays, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ChallengeCelebration } from '@/components/engagement/celebration';
import { ChallengeRow, NextStepCard, StarTotal } from '@/components/engagement/challenges';
import { JourneyMap } from '@/components/engagement/journey-map';
import { SkillCollection } from '@/components/engagement/skill-collection';
import { PendingSurveysCard } from '@/components/satisfaction/pending-card';
import { LevelMeter } from '@/components/ui/level-meter';
import { Card, CardBody, CardHeader, Notice } from '@/components/ui/primitives';
import { loadParticipantEngagement } from '@/lib/engagement/load';
import { loadMySurveys } from '@/lib/satisfaction/load';
import { createClient } from '@/lib/supabase/server';
import { formatScore, formatShortDate, formatTimeRange } from '@/lib/utils';

import { getMyPassport } from '../data';
import { SignToday, type SignableSession } from '../emargement/sign-today';

export const metadata: Metadata = { title: 'Mon passeport' };

export default async function ParticipantDashboard({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { bienvenue } = await searchParams;
  const [{ passport, supabase }, signable] = await Promise.all([getMyPassport(), loadSignableSessions()]);
  const [surveys, { data: consents }] = await Promise.all([loadMySurveys(supabase), supabase.rpc('my_referral_consents')]);
  const engagement = await loadParticipantEngagement(supabase, passport, surveys);
  // Personne orientée par un prescripteur : elle confirme elle-même ses consentements.
  const consentsPending = (consents ?? []).some((row) => !row.participant_confirmed_at);
  const { participant, group } = passport;
  const total = group?.sessionsCount ?? 6;
  const upcoming = passport.currentSession ?? passport.nextSession;
  const selfDone = passport.selfAssessment?.status === 'completed';
  const lastEvaluation = passport.evaluations.at(-1);
  const featured = passport.frameworks.flatMap((framework) =>
    framework.highlights.strengths.slice(0, 2).map((summary) => ({ framework, skill: framework.skills.find((skill) => skill.code === summary.skillCode)! })),
  );
  // Défis en cours : faisables, pas encore réussis, les plus proches du but d'abord (hors prochaine étape).
  const inProgress = engagement.challenges
    .filter((item) => item.available && !item.done && item.id !== engagement.next?.id)
    .sort((a, b) => b.current / b.target - a.current / a.target)
    .slice(0, 3);
  const hasWord = Boolean(lastEvaluation?.observation || lastEvaluation?.advice);
  // Le mot du formateur prend la place de la prochaine étape quand il n'y en a pas ; sinon, il passe plus bas.
  const showWordBelow = Boolean(engagement.next) && hasWord;
  const headline = engagement.journey.finished
    ? 'Votre parcours est terminé, bravo'
    : passport.completedSessions === 0
      ? 'Votre parcours HAPPI commence'
      : `Session ${Math.min(passport.completedSessions + 1, total)} sur ${total}`;

  return (
    <div className="space-y-6">
      <ChallengeCelebration
        storageKey={`happi:defis-celebres:${participant.id}`}
        challenges={engagement.challenges.map(({ id, title, goal, stars, done }) => ({ id, title, goal, stars, done }))}
      />
      {consentsPending ? (
        <Notice
          variant="warning"
          title="Confirmez vos consentements"
          action={
            <Link href="/participant/consentements" className="text-sm font-semibold text-ink underline underline-offset-4">
              Confirmer
            </Link>
          }
        >
          La structure qui vous a orienté(e) a indiqué vos choix (droit à l’image, partage de vos résultats). Vérifiez-les et confirmez-les vous-même.
        </Notice>
      ) : null}
      {bienvenue && selfDone ? (
        <Notice variant="success" title="Bienvenue dans votre passeport de compétences">
          Votre auto-évaluation est enregistrée. Elle servira de point de départ pour suivre votre progression.
        </Notice>
      ) : null}

      {/* Le parcours, session par session : la pièce maîtresse de l'accueil. */}
      <section className="pixel-grid relative overflow-hidden rounded-xl bg-petrol-900 px-5 pt-6 pb-6 text-white sm:px-8 sm:pt-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <p className="text-white/65">Bonjour {participant.firstName},</p>
            <h1 className="mt-1 font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-white sm:text-[2.125rem]">{headline}</h1>
            {upcoming && !engagement.journey.finished ? (
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-white/75">
                <span className="font-semibold text-white">
                  {passport.currentSession ? 'Aujourd’hui' : 'Prochaine session'} : {upcoming.title}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-orange-300" aria-hidden />
                  {upcoming.date ? `${formatShortDate(upcoming.date)} · ${formatTimeRange(upcoming.startTime, upcoming.endTime)}` : 'Date à définir'}
                </span>
                {upcoming.location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 text-orange-300" aria-hidden />
                    {upcoming.location}
                  </span>
                ) : null}
              </p>
            ) : !group ? (
              <p className="mt-3 text-white/75">Votre formateur ou votre organisme vous ajoutera à un groupe avec l’adresse {participant.email}.</p>
            ) : null}
          </div>
          <Link
            href="/participant/reussites"
            className="shrink-0 rounded-lg bg-white/[0.06] px-4 py-3 ring-1 ring-white/10 transition-colors hover:bg-white/10"
          >
            <span className="sr-only">Mes réussites : </span>
            <StarTotal {...engagement.stars} tone="dark" />
          </Link>
        </div>
        <div className="mt-6 sm:mt-8">
          <JourneyMap stations={engagement.journey.stations} currentNumber={engagement.journey.currentNumber} finished={engagement.journey.finished} />
        </div>
      </section>

      {signable.length > 0 ? <SignToday sessions={signable} /> : null}
      <PendingSurveysCard surveys={surveys} basePath="/participant/satisfaction" />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {engagement.next ? (
          <NextStepCard challenge={engagement.next} />
        ) : hasWord && lastEvaluation ? (
          <TrainerWord evaluation={lastEvaluation} />
        ) : (
          <section className="flex h-full flex-col justify-center rounded-xl border border-line bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Tout est fait de votre côté</h2>
            <p className="mt-1 text-[0.9375rem] text-ink-muted">Les prochains défis se débloquent pendant les sessions, avec les observations de vos formateurs.</p>
          </section>
        )}
        <Card>
          <CardHeader
            title="Défis en cours"
            action={
              <Link href="/participant/reussites" className="text-sm font-semibold text-petrol-700 hover:text-petrol-950">
                Tous mes défis
              </Link>
            }
          />
          <CardBody className="pt-1">
            {inProgress.length > 0 ? (
              <ul className="space-y-5">
                {inProgress.map((item) => (
                  <li key={item.id}>
                    <ChallengeRow challenge={item} compact />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.9375rem] text-ink-muted">Tous les défis ouverts sont réussis. Les suivants s’ouvrent au fil du parcours.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`Mes compétences révélées : ${engagement.collection.revealed} sur ${engagement.collection.total}`}
          description="Chaque case s’allume quand vos formateurs observent la compétence pendant une session. Touchez une case pour la découvrir."
        />
        <CardBody className="pt-1">
          <SkillCollection groups={engagement.collection.groups} />
        </CardBody>
      </Card>

      {showWordBelow || featured.length > 0 ? (
        <div className={showWordBelow && featured.length > 0 ? 'grid gap-6 lg:grid-cols-2' : 'grid gap-6'}>
          {showWordBelow && lastEvaluation ? <TrainerWord evaluation={lastEvaluation} /> : null}
          {featured.length > 0 ? (
            <Card>
              <CardHeader
                title="Mes points forts"
                description="Les compétences les plus affirmées dans les observations de vos formateurs."
                action={
                  <Link href="/participant/bilan" className="text-sm font-semibold text-petrol-700 hover:text-petrol-950">
                    Mon bilan
                  </Link>
                }
              />
              <CardBody>
                <ul className={showWordBelow ? 'space-y-5' : 'grid gap-x-10 gap-y-5 md:grid-cols-2'}>
                  {featured.map(({ framework, skill }) => (
                    <li key={`${framework.code}-${skill.code}`}>
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <span>
                          <span className="font-semibold text-ink">{skill.name}</span>
                          <span className="ml-2 text-sm text-ink-subtle">{framework.shortName}</span>
                        </span>
                        <span className="text-sm text-ink-muted">{skill.level?.label}</span>
                      </div>
                      <LevelMeter
                        value={skill.summary.value}
                        min={framework.rules.scaleMin}
                        max={framework.rules.scaleMax}
                        label={`${skill.name} : ${formatScore(skill.summary.value)} sur ${framework.rules.scaleMax}`}
                      />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TrainerWord({ evaluation }: { evaluation: { sessionNumber: number; evaluator: string | null; observation: string | null; advice: string | null } }) {
  return (
    <Card>
      <CardHeader title="Le mot de votre formateur" description={`Session ${evaluation.sessionNumber}${evaluation.evaluator ? ` · ${evaluation.evaluator}` : ''}`} />
      <CardBody className="space-y-3 text-[0.9375rem]">
        {evaluation.observation ? <p className="text-ink">« {evaluation.observation} »</p> : null}
        {evaluation.advice ? (
          <p className="rounded-md bg-orange-50 px-3 py-2 text-ink">
            <span className="font-semibold">Conseil : </span>
            {evaluation.advice}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Séances du jour à émarger (fonction de la base : ne renvoie que les séances du participant connecté). */
async function loadSignableSessions(): Promise<SignableSession[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_attendance_signing');
  return (data ?? []).map((row) => ({
    sessionId: row.session_id,
    number: row.session_number,
    title: row.title,
    groupName: row.group_name,
    date: row.scheduled_date,
    startTime: row.start_time,
    endTime: row.end_time,
    attendanceStatus: row.attendance_status,
    signedAt: row.signed_at,
    frozen: row.frozen,
    canSign: row.can_sign,
  }));
}
