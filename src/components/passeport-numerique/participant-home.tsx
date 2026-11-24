import { ArrowRight, Hourglass, Mail, MonitorSmartphone } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { PASSEPORT_FACTS } from '@/lib/passeport-numerique/meta';

/** Accueil d'un participant inscrit au Passeport Numérique : un seul geste, reprendre ses exercices. */
export function PasseportNumeriqueHome({ firstName }: { firstName: string }) {
  return (
    <div className="space-y-6">
      <section className="pixel-grid relative overflow-hidden rounded-xl bg-petrol-900 px-5 py-7 text-white sm:px-8 sm:py-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="text-white/65">Bonjour {firstName},</p>
            <h1 className="mt-1 font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-white sm:text-[2.125rem]">Votre Passeport Numérique</h1>
            <p className="mt-3 text-white/75">Découvrez le numérique pas à pas, à votre rythme. Votre progression est gardée : vous reprenez toujours là où vous vous êtes arrêté(e).</p>
            <Link
              href="/participant/passeport-numerique"
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-orange-650 px-6 text-lg font-semibold text-white transition-colors hover:bg-orange-700"
            >
              <MonitorSmartphone className="size-5" aria-hidden />
              Continuer mes exercices
              <ArrowRight className="size-5" aria-hidden />
            </Link>
          </div>
          <Image src="/brand/happi-mascotte-3d.webp" alt="" width={120} height={200} className="hidden h-40 w-auto shrink-0 sm:block" priority />
        </div>
      </section>
      <dl className="grid grid-cols-3 gap-3 sm:gap-4">
        {PASSEPORT_FACTS.map((fact) => (
          <div key={fact.label} className="flex flex-col rounded-xl border border-line bg-white px-4 py-4">
            <dt className="text-sm leading-snug text-ink-muted">{fact.label}</dt>
            <dd className="order-first font-display text-[1.75rem] font-semibold text-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p className="rounded-lg bg-orange-50 p-4 text-[0.9375rem] text-ink-muted">
        Votre progression est enregistrée sur l’appareil que vous utilisez. Pour retrouver vos exercices, reprenez le même téléphone, la même tablette ou le même ordinateur.
      </p>
    </div>
  );
}

/** Compte créé, pas encore validé : les ateliers se font en présentiel, avec un formateur. */
export function PasseportNumeriquePending({ firstName }: { firstName: string }) {
  return (
    <div className="space-y-6">
      <section className="pixel-grid relative overflow-hidden rounded-xl bg-petrol-900 px-5 py-7 text-white sm:px-8 sm:py-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="text-white/65">Bonjour {firstName},</p>
            <h1 className="mt-1 flex items-center gap-3 font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-white sm:text-[2.125rem]">
              <Hourglass className="size-7 shrink-0 text-orange-300" aria-hidden />
              Votre compte est en attente de validation
            </h1>
            <p className="mt-3 text-white/75">
              Votre compte a bien été créé. Il doit être validé par votre formateur, qui vous rattache à une session du Passeport Numérique. Les ateliers se font uniquement en présentiel, avec un formateur.
            </p>
          </div>
          <Image src="/brand/happi-mascotte-3d.webp" alt="" width={120} height={200} className="hidden h-40 w-auto shrink-0 sm:block" priority />
        </div>
      </section>
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Vous n’êtes inscrit(e) à aucune session ?</h2>
        <p className="mt-1 text-[0.9375rem] text-ink-muted">Contactez votre organisme, ou prenez contact avec l’équipe HAPPI : nous vous rattacherons à une session.</p>
        <Link
          href="/contact"
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-orange-650 px-5 font-semibold text-white transition-colors hover:bg-orange-700"
        >
          <Mail className="size-5" aria-hidden />
          Nous contacter
        </Link>
      </section>
    </div>
  );
}
