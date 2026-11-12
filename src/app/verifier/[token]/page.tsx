import { BadgeCheck, CalendarRange, Eye, Info, ShieldOff } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { Logo } from '@/components/brand/logo';
import { LevelMeter } from '@/components/ui/level-meter';
import { ProvisionalBadge } from '@/components/ui/primitives';
import type { PublicPassport } from '@/lib/passport-share/public-view';
import { resolvePublicPassport } from '@/lib/passport-share/server';
import { clientIpFrom } from '@/lib/passport-share/token';
import { formatDate, formatDateTime, formatScore } from '@/lib/utils';

/**
 * Vérification publique d'un passeport partagé. Hors espaces connectés, jamais
 * indexée, jamais mise en cache partagé ; en-têtes posés aussi par next.config.ts
 * et src/proxy.ts (Referrer-Policy: no-referrer, Cache-Control: private, no-store).
 */
export const metadata: Metadata = {
  title: 'Vérification d’un passeport',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

export default async function VerifierPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const passport = await resolvePublicPassport(token, clientIpFrom(await headers()));
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo />
          <span className="text-sm font-semibold text-ink-muted">Vérification de passeport</span>
        </div>
      </header>
      <main id="contenu" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">{passport ? <Verified passport={passport} /> : <Unavailable />}</main>
    </div>
  );
}

/** Message unique pour tout lien non valide : inconnu, expiré ou révoqué. */
function Unavailable() {
  return (
    <section className="rounded-xl border border-line bg-white px-6 py-12 text-center">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-petrol-50 text-petrol-600">
        <ShieldOff className="size-6" aria-hidden />
      </span>
      <h1 className="font-display text-xl font-semibold text-ink">Ce lien de vérification n’est pas disponible</h1>
      <p className="mx-auto mt-2 max-w-md text-ink-muted">
        Le lien est peut-être incomplet, arrivé à expiration ou retiré par son titulaire. Demandez-lui de vous en transmettre un nouveau.
      </p>
    </section>
  );
}

function Verified({ passport }: { passport: PublicPassport }) {
  return (
    <article className="space-y-6">
      <section className="rounded-xl bg-petrol-900 px-6 py-6 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold text-petrol-100">
          <BadgeCheck className="size-5 text-orange-400" aria-hidden />
          Passeport de compétences délivré par {passport.issuer}
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
          {passport.holder.firstName} {passport.holder.lastInitial}
        </h1>
        {passport.program ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-petrol-100">
            <span>{passport.program.name}</span>
            {passport.program.startDate ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange className="size-4" aria-hidden />
                du {formatDate(passport.program.startDate)} au {formatDate(passport.program.endDate, 'date à définir')}
              </span>
            ) : null}
          </p>
        ) : null}
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-petrol-200">Séances d’observation</dt>
            <dd className="text-lg font-semibold">{passport.observationSessions}</dd>
          </div>
          <div>
            <dt className="text-petrol-200">Données au</dt>
            <dd className="font-semibold">{formatDateTime(passport.generatedAt)}</dd>
          </div>
          <div>
            <dt className="text-petrol-200">Lien valable jusqu’au</dt>
            <dd className="font-semibold">{formatDate(passport.expiresAt)}</dd>
          </div>
        </dl>
      </section>

      <p className="flex gap-3 rounded-md border border-petrol-200 bg-petrol-50 px-4 py-3 text-sm text-petrol-800" role="note">
        <Info className="mt-0.5 size-[1.125rem] shrink-0" aria-hidden />
        <span>{passport.method}</span>
      </p>

      {passport.frameworks.map((framework) => (
        <section key={framework.code} className="rounded-xl border border-line bg-white" aria-labelledby={`referentiel-${framework.code}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6">
            <h2 id={`referentiel-${framework.code}`} className="text-[1.0625rem] font-semibold">
              {framework.name}
            </h2>
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              {framework.skills.length} observée{framework.skills.length > 1 ? 's' : ''} sur {framework.totalSkills}
              {framework.isProvisional ? <ProvisionalBadge>Référentiel provisoire</ProvisionalBadge> : null}
            </span>
          </div>
          <p className="px-5 pt-1 text-sm text-ink-subtle sm:px-6">
            Échelle de {framework.scaleMin} à {framework.scaleMax} : {framework.levels.map((level) => `${level.value} ${level.label}`).join(' · ')}.
          </p>
          {framework.skills.length > 0 ? (
            <ul className="divide-y divide-line px-5 py-3 sm:px-6">
              {framework.skills.map((skill) => (
                <li key={skill.code} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-ink">{skill.name}</h3>
                    <span className="text-sm font-semibold text-petrol-800">
                      {skill.levelLabel ?? `Niveau ${formatScore(skill.value)}`} · {formatScore(skill.value)}/{framework.scaleMax}
                    </span>
                  </div>
                  <LevelMeter
                    value={skill.value}
                    min={framework.scaleMin}
                    max={framework.scaleMax}
                    className="mt-2"
                    label={`${skill.name} : niveau ${formatScore(skill.value)} sur ${framework.scaleMax}${skill.levelLabel ? `, ${skill.levelLabel}` : ''}`}
                  />
                  {skill.descriptor ? <p className="mt-2 text-sm text-ink-muted">{skill.descriptor}</p> : null}
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-subtle">
                    <Eye className="size-3.5" aria-hidden />
                    Observée sur {skill.observationCount} séance{skill.observationCount > 1 ? 's' : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-5 text-sm text-ink-muted sm:px-6">Aucune compétence de ce référentiel n’a encore été observée.</p>
          )}
        </section>
      ))}

      {passport.report ? (
        <section className="rounded-xl border border-line bg-white px-5 py-5 sm:px-6" aria-labelledby="bilan">
          <h2 id="bilan" className="text-[1.0625rem] font-semibold">
            Bilan HAPPI validé
          </h2>
          <p className="mt-1 text-sm text-ink-subtle">
            Version {passport.report.version}
            {passport.report.finalizedAt ? `, validée le ${formatDate(passport.report.finalizedAt)}` : ''}. Texte rédigé et validé par l’équipe HAPPI.
          </p>
          {passport.report.summary ? <p className="mt-4 whitespace-pre-line text-ink">{passport.report.summary}</p> : null}
          {passport.report.frameworks.map((item) => (
            <div key={item.code} className="mt-4">
              <h3 className="font-semibold">{item.name}</h3>
              <p className="mt-1 whitespace-pre-line text-ink-muted">{item.summary}</p>
            </div>
          ))}
          {passport.report.conclusion ? (
            <div className="mt-4">
              <h3 className="font-semibold">Conclusion</h3>
              <p className="mt-1 whitespace-pre-line text-ink-muted">{passport.report.conclusion}</p>
            </div>
          ) : null}
          {passport.report.limits ? <p className="mt-4 border-t border-line pt-4 text-sm whitespace-pre-line text-ink-subtle">Limites : {passport.report.limits}</p> : null}
        </section>
      ) : null}

      <footer className="text-center text-sm text-ink-subtle">
        Page générée le {formatDateTime(passport.generatedAt)} par {passport.issuer}. Les niveaux reflètent les évaluations validées à cette date.
      </footer>
    </article>
  );
}
