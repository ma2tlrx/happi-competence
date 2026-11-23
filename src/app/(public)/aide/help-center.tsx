'use client';

import { Lightbulb, Mail, MessageSquare, Search } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';

import { HELP_AUDIENCES, HELP_FAQ, HELP_GUIDES, guideText, matchesHelp, questionText, type HelpAudience } from '@/lib/help/content';
import { cn } from '@/lib/utils';

type Filter = HelpAudience | 'tous';

/** Recherche et filtre par espace, entièrement côté navigateur (contenu statique). */
export function HelpCenter({ audience, contactEmail }: { audience: HelpAudience | null; contactEmail: string }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(audience ?? 'tous');
  const searchId = useId();
  const guides = HELP_GUIDES.filter((guide) => (filter === 'tous' || guide.audience === filter) && matchesHelp(guideText(guide), query));
  const questions = HELP_FAQ.filter((item) => matchesHelp(questionText(item), query));
  const groups = (Object.keys(HELP_AUDIENCES) as HelpAudience[])
    .map((key) => ({ key, items: guides.filter((guide) => guide.audience === key) }))
    .filter((group) => group.items.length > 0)
    // L'espace de la personne connectée d'abord.
    .sort((a, b) => Number(b.key === audience) - Number(a.key === audience));
  const total = guides.length + questions.length;

  return (
    <div className="space-y-12">
      <div role="search" className="space-y-4">
        <div className="max-w-xl">
          <label htmlFor={searchId} className="mb-1.5 block font-semibold text-ink">
            Rechercher dans l’aide
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Exemple : émarger, mot de passe, bilan"
              className="h-12 w-full rounded-md border border-line-strong bg-white pr-3 pl-10 text-base text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange-500"
            />
          </div>
        </div>
        <div role="group" aria-label="Afficher les guides de l’espace" className="flex flex-wrap gap-2">
          {(['tous', ...Object.keys(HELP_AUDIENCES)] as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                'min-h-9 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500',
                filter === key ? 'border-petrol-900 bg-petrol-900 text-white' : 'border-line-strong bg-white text-ink hover:border-petrol-400',
              )}
            >
              {key === 'tous' ? 'Tous les espaces' : HELP_AUDIENCES[key]}
              {key === audience ? <span className="font-normal"> (vous)</span> : null}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-muted" aria-live="polite">
          {query.trim() ? `${total} résultat${total > 1 ? 's' : ''} pour « ${query.trim()} ».` : null}
        </p>
      </div>

      <section aria-labelledby="guides-titre" className="space-y-8">
        <h2 id="guides-titre" className="font-display text-2xl font-semibold text-ink">
          Guides
        </h2>
        {groups.length === 0 ? (
          <p className="text-ink-muted">Aucun guide ne correspond. Essayez un autre mot, ou choisissez « Tous les espaces ».</p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="space-y-4">
              <h3 className="text-lg font-semibold text-petrol-700">
                {group.key === audience ? `Votre espace : ${HELP_AUDIENCES[group.key].toLowerCase()}` : `Espace ${HELP_AUDIENCES[group.key].toLowerCase()}`}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {group.items.map((guide) => (
                  <article key={guide.id} id={guide.id} aria-labelledby={`${guide.id}-titre`} className="rounded-lg border border-line bg-paper p-5">
                    <h4 id={`${guide.id}-titre`} className="font-display text-lg font-semibold text-ink">
                      {guide.title}
                    </h4>
                    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[0.9375rem] text-ink">
                      {guide.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    {guide.tip ? (
                      <p className="mt-3 flex gap-2 text-sm text-ink-muted">
                        <Lightbulb className="mt-0.5 size-4 shrink-0 text-orange-700" aria-hidden />
                        <span>{guide.tip}</span>
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section aria-labelledby="faq-titre" className="space-y-4">
        <h2 id="faq-titre" className="font-display text-2xl font-semibold text-ink">
          Questions fréquentes
        </h2>
        {questions.length === 0 ? (
          <p className="text-ink-muted">Aucune question ne correspond.</p>
        ) : (
          <div className="divide-y divide-line rounded-lg border border-line">
            {questions.map((item) => (
              <details key={item.id} id={item.id} className="group px-5 py-4">
                <summary className="cursor-pointer font-semibold text-ink marker:text-petrol-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">
                  {item.question}
                </summary>
                <p className="mt-2 text-[0.9375rem] text-ink-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="contact-titre" className="rounded-lg bg-petrol-900 p-6 text-white sm:p-8">
        <h2 id="contact-titre" className="font-display text-2xl font-semibold text-white">
          Besoin d’aide ?
        </h2>
        <p className="mt-2 text-white/75">Vous ne trouvez pas la réponse ? Écrivez-nous en précisant votre espace et l’écran concerné.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/contact"
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-orange-650 px-4 font-semibold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <MessageSquare className="size-4" aria-hidden />
            Formulaire de contact
          </Link>
          <a
            href={`mailto:${contactEmail}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/30 px-4 font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Mail className="size-4" aria-hidden />
            {contactEmail}
          </a>
        </div>
      </section>
    </div>
  );
}
