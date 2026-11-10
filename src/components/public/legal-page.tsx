import type { ReactNode } from 'react';

import { PageHero } from './sections';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <PageHero title={title} intro={`Dernière mise à jour : ${updated}`} />
      <div className="bg-white py-14 sm:py-20">
        <article className="container-prose prose-happi [&_h2]:mt-10 [&_h2]:text-xl">{children}</article>
      </div>
    </>
  );
}

/** Valeur administrable, signalée tant qu'elle n'est pas renseignée. */
export function LegalValue({ value }: { value: string }) {
  if (value) return <>{value}</>;
  return <span className="rounded-xs bg-warning-soft px-1.5 py-0.5 text-[0.9em] font-medium text-warning">à compléter par HAPPI</span>;
}
