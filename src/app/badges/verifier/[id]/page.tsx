import { Award, BadgeCheck, Ban, ShieldAlert, ShieldOff } from 'lucide-react';
import type { Metadata } from 'next';

import { Logo } from '@/components/brand/logo';
import { localImagePath, resolvePublicBadge, type PublicBadge } from '@/lib/badges/server';
import { formatDate } from '@/lib/utils';

/**
 * Vérification publique d'un Open Badge. La signature (clé publique de l'émetteur),
 * l'empreinte enregistrée et la révocation sont contrôlées côté serveur. Hors espaces
 * connectés, jamais indexée ni mise en cache partagé (en-têtes posés aussi par
 * next.config.ts et src/proxy.ts), message neutre pour un identifiant inconnu.
 */
export const metadata: Metadata = {
  title: 'Vérification d’un badge',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

export default async function BadgeVerifierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const badge = await resolvePublicBadge(id);
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo />
          <span className="text-sm font-semibold text-ink-muted">Vérification de badge</span>
        </div>
      </header>
      <main id="contenu" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {!badge ? (
          <Message icon={ShieldOff} title="Ce lien de vérification n’est pas disponible">
            Le lien est peut-être incomplet ou erroné. Demandez à la personne concernée de vous le transmettre à nouveau.
          </Message>
        ) : badge.check === 'tampered' ? (
          <Message icon={ShieldAlert} title="Ce badge n’a pas pu être authentifié" tone="danger">
            La signature ou le contenu de ce badge ne correspondent pas à ceux enregistrés par l’émetteur. Ne vous fiez pas à ce document et contactez HAPPI Compétence.
          </Message>
        ) : badge.check === 'unverifiable' ? (
          <Message icon={ShieldOff} title="Vérification momentanément impossible">
            La signature de ce badge ne peut pas être contrôlée pour le moment. Réessayez plus tard ou contactez HAPPI Compétence.
          </Message>
        ) : (
          <Verified badge={badge} />
        )}
      </main>
    </div>
  );
}

function Message({ icon: Icon, title, tone, children }: { icon: typeof ShieldOff; title: string; tone?: 'danger'; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white px-6 py-12 text-center" role={tone === 'danger' ? 'alert' : undefined}>
      <span className={`mx-auto mb-4 flex size-12 items-center justify-center rounded-lg ${tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-petrol-50 text-petrol-600'}`}>
        <Icon className="size-6" aria-hidden />
      </span>
      <h1 className="font-display text-xl font-semibold text-ink">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-ink-muted">{children}</p>
    </section>
  );
}

function Verified({ badge }: { badge: PublicBadge }) {
  const revoked = badge.check === 'revoked';
  const image = localImagePath(badge.badge?.imageUrl);
  return (
    <article className="space-y-6">
      <section className={`rounded-xl px-6 py-6 ${revoked ? 'border border-line bg-white text-ink' : 'bg-petrol-900 text-white'}`}>
        <p className={`flex items-center gap-2 text-sm font-semibold ${revoked ? 'text-danger' : 'text-petrol-100'}`} role="status">
          {revoked ? <Ban className="size-5" aria-hidden /> : <BadgeCheck className="size-5 text-orange-400" aria-hidden />}
          {revoked ? `Badge révoqué par l’émetteur le ${formatDate(badge.revokedAt)}` : `Badge authentique et valide, délivré par ${badge.issuer}`}
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- image du badge, servie par le site
            <img src={image} alt="" className="size-20 shrink-0 rounded-lg bg-white object-contain p-1.5" />
          ) : (
            <span className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <Award className="size-10" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold break-words sm:text-3xl">{badge.badge?.name}</h1>
            {badge.holder ? (
              <p className={revoked ? 'mt-1 text-ink-muted' : 'mt-1 text-petrol-100'}>
                Délivré à {badge.holder.firstName} {badge.holder.lastInitial} le {formatDate(badge.issuedAt)}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {revoked ? (
        <p className="rounded-md border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger" role="note">
          Ce badge a bien été émis par {badge.issuer}, mais il a été retiré depuis : il ne doit plus être considéré comme valable.
        </p>
      ) : null}

      {badge.badge ? (
        <section className="rounded-xl border border-line bg-white px-5 py-5 sm:px-6" aria-labelledby="badge-description">
          <h2 id="badge-description" className="text-[1.0625rem] font-semibold">
            Ce que ce badge atteste
          </h2>
          <p className="mt-2 whitespace-pre-line text-ink-muted">{badge.badge.description}</p>
          <h2 className="mt-5 text-[1.0625rem] font-semibold">Critères d’obtention</h2>
          <p className="mt-2 whitespace-pre-line text-ink-muted">{badge.badge.criteria}</p>
        </section>
      ) : null}

      <footer className="text-center text-sm text-ink-subtle">
        Vérification faite par le serveur de {badge.issuer} : signature numérique du badge (Open Badges 3.0, RS256) et registre des révocations.
      </footer>
    </article>
  );
}
