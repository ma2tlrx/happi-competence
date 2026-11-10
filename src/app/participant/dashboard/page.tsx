import { ArrowRight, CalendarDays, ClipboardCheck, FileText, ListChecks, MapPin, Radar, Route, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { LevelMeter, SessionSteps } from '@/components/ui/level-meter';
import { Card, CardBody, CardHeader, EmptyState, Notice } from '@/components/ui/primitives';
import { formatDate, formatScore, formatShortDate, formatTimeRange, pluralize } from '@/lib/utils';

import { getMyPassport } from '../data';

export const metadata: Metadata = { title: 'Mon passeport' };

export default async function ParticipantDashboard({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { bienvenue } = await searchParams;
  const { passport } = await getMyPassport();
  const { participant, group, sessions } = passport;
  const total = group?.sessionsCount ?? 6;
  const observed = passport.frameworks.reduce((sum, framework) => sum + framework.observedCount, 0);
  const skillsTotal = passport.frameworks.reduce((sum, framework) => sum + framework.skills.length, 0);
  const featured = passport.frameworks.flatMap((framework) =>
    framework.highlights.strengths.slice(0, 2).map((summary) => ({ framework, skill: framework.skills.find((skill) => skill.code === summary.skillCode)! })),
  );
  const lastEvaluation = passport.evaluations.at(-1);
  const upcoming = passport.currentSession ?? passport.nextSession;
  const selfDone = passport.selfAssessment?.status === 'completed';

  return (
    <div className="space-y-6">
      {bienvenue && selfDone ? (
        <Notice variant="success" title="Bienvenue dans votre passeport de compétences">
          Votre auto-évaluation est enregistrée. Elle servira de point de départ pour suivre votre progression.
        </Notice>
      ) : null}

      {/* Présentation et avancement */}
      <section className="pixel-grid relative overflow-hidden rounded-xl bg-petrol-900 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-white/65">Bonjour {participant.firstName},</p>
            <h1 className="mt-1 font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-white sm:text-[2.125rem]">
              {passport.completedSessions === 0
                ? 'Votre parcours HAPPI commence'
                : passport.completedSessions >= total
                  ? 'Votre parcours est terminé, bravo'
                  : `Session ${Math.min(passport.completedSessions + 1, total)} sur ${total}`}
            </h1>
            <p className="mt-2 text-white/70">
              {participant.firstName} {participant.lastName}
              {participant.organization ? ` · ${participant.organization.name}` : ''}
              {group ? ` · ${group.programName}` : ''}
            </p>
          </div>
          <div className="w-full max-w-sm">
            <div className="mb-2 flex justify-between text-sm text-white/70">
              <span>Avancement</span>
              <span className="font-semibold text-white">
                {passport.completedSessions}/{total} sessions
              </span>
            </div>
            <SessionSteps total={total} completed={passport.completedSessions} current={upcoming?.number ?? null} tone="dark" />
          </div>
        </div>
      </section>

      {!selfDone ? (
        <Notice
          variant="info"
          title="Commencez par votre auto-évaluation"
          action={
            <Button asChild size="sm">
              <Link href="/participant/auto-evaluation">Répondre</Link>
            </Button>
          }
        >
          Quinze affirmations, environ cinq minutes. Vos réponses servent de point de départ et restent visibles dans votre passeport.
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="px-5 py-4">
          <p className="text-sm text-ink-muted">Sessions réalisées</p>
          <p className="mt-1 font-display text-[1.75rem] font-semibold">{passport.completedSessions}<span className="text-lg text-ink-subtle">/{total}</span></p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-sm text-ink-muted">Sessions suivies</p>
          <p className="mt-1 font-display text-[1.75rem] font-semibold">{passport.attendedSessions}</p>
          <p className="text-sm text-ink-subtle">sur {pluralize(passport.completedSessions, 'session passée', 'sessions passées')}</p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-sm text-ink-muted">Compétences observées</p>
          <p className="mt-1 font-display text-[1.75rem] font-semibold">{observed}<span className="text-lg text-ink-subtle">/{skillsTotal}</span></p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-sm text-ink-muted">Dernière évaluation</p>
          <p className="mt-1 font-display text-lg font-semibold">{lastEvaluation ? `Session ${lastEvaluation.sessionNumber}` : 'À venir'}</p>
          <p className="text-sm text-ink-subtle">{lastEvaluation ? formatDate(lastEvaluation.validatedAt) : 'Après votre première session'}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title="Compétences mises en avant"
            description="Les compétences les plus affirmées dans les observations de vos formateurs."
            action={
              <Link href="/participant/bilan" className="text-sm font-semibold text-petrol-700 hover:text-petrol-950">
                Mon bilan
              </Link>
            }
          />
          <CardBody>
            {featured.length > 0 ? (
              <ul className="space-y-5">
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
            ) : (
              <EmptyState
                icon={Sparkles}
                title="Encore un peu de patience"
                description="Vos points forts apparaîtront dès que vos formateurs auront observé suffisamment de compétences, généralement après deux sessions."
              />
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title={passport.currentSession ? 'Session du jour' : 'Prochaine session'} />
            <CardBody>
              {upcoming ? (
                <div>
                  <p className="font-display text-lg font-semibold">
                    Session {upcoming.number} · {upcoming.title}
                  </p>
                  <ul className="mt-3 space-y-2 text-[0.9375rem] text-ink-muted">
                    <li className="flex items-center gap-2.5">
                      <CalendarDays className="size-4 text-petrol-500" aria-hidden />
                      {upcoming.date ? `${formatShortDate(upcoming.date)} · ${formatTimeRange(upcoming.startTime, upcoming.endTime)}` : 'Date à définir'}
                    </li>
                    {upcoming.location ? (
                      <li className="flex items-center gap-2.5">
                        <MapPin className="size-4 text-petrol-500" aria-hidden />
                        {upcoming.location}
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : group ? (
                <p className="text-ink-muted">Aucune session planifiée pour le moment.</p>
              ) : (
                <p className="text-ink-muted">
                  Vous n’êtes pas encore inscrit dans un groupe. Votre formateur ou votre organisme vous y ajoutera avec l’adresse {participant.email}.
                </p>
              )}
            </CardBody>
          </Card>
          {lastEvaluation?.observation || lastEvaluation?.advice ? (
            <Card>
              <CardHeader title="Le mot de votre formateur" description={`Session ${lastEvaluation.sessionNumber}${lastEvaluation.evaluator ? ` · ${lastEvaluation.evaluator}` : ''}`} />
              <CardBody className="space-y-3 text-[0.9375rem]">
                {lastEvaluation.observation ? <p className="text-ink">« {lastEvaluation.observation} »</p> : null}
                {lastEvaluation.advice ? (
                  <p className="rounded-md bg-orange-50 px-3 py-2 text-ink">
                    <span className="font-semibold">Conseil : </span>
                    {lastEvaluation.advice}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <nav aria-label="Mon passeport" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/participant/competences-transversales', icon: Radar, title: 'Compétences transversales', text: 'Radar, niveaux et évolutions' },
          { href: '/participant/habiletes-sociocognitives', icon: Sparkles, title: 'Habiletés socio-cognitives', text: 'Les cinq dimensions' },
          { href: '/participant/parcours', icon: Route, title: 'Mon parcours', text: 'Les sessions et mes notes' },
          { href: selfDone ? '/participant/bilan' : '/participant/auto-evaluation', icon: selfDone ? FileText : ListChecks, title: selfDone ? 'Mon bilan' : 'Mon auto-évaluation', text: selfDone ? 'Synthèse et export PDF' : 'À compléter' },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="group flex items-center gap-4 rounded-lg border border-line bg-white p-4 transition-[border-color,box-shadow] hover:border-petrol-300 hover:shadow-sm">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-petrol-50 text-petrol-700 transition-colors group-hover:bg-orange-100 group-hover:text-orange-700">
              <item.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{item.title}</span>
              <span className="block text-sm text-ink-muted">{item.text}</span>
            </span>
            <ArrowRight className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ))}
      </nav>
      {passport.sessions.some((session) => session.attendance) ? null : (
        <p className="flex items-center gap-2 text-sm text-ink-subtle">
          <ClipboardCheck className="size-4" aria-hidden />
          Vos présences apparaîtront après chaque session.
        </p>
      )}
    </div>
  );
}
