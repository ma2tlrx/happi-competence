import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHero } from '@/components/public/sections';
import type { PublicIndicator } from '@/lib/quality/indicators';
import { COMPLETION_RATE_DEFINITION, PUBLIC_MIN_N, SATISFACTION_RATE_DEFINITION } from '@/lib/quality/labels';
import { getPublicResults } from '@/lib/quality/public';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Nos résultats',
  description: 'Indicateurs de résultats de l’accompagnement HAPPI : satisfaction, réalisation, assiduité, nombre de participants.',
};

const ITEMS = [
  { key: 'participants', label: 'Participants accompagnés', definition: 'Nombre de parcours (inscriptions à un groupe) sur la période, abandons compris.' },
  { key: 'completion', label: 'Taux de réalisation', definition: COMPLETION_RATE_DEFINITION.replace(' Mode de calcul provisoire — à valider.', '') },
  { key: 'attendance', label: 'Assiduité', definition: 'Présences (y compris retards et départs anticipés) sur les présences renseignées des séances réalisées.' },
  { key: 'satisfaction', label: 'Satisfaction des participants', definition: SATISFACTION_RATE_DEFINITION.replace(' Mode de calcul provisoire — à valider.', '') },
] as const;

function Value({ id, indicator }: { id: string; indicator: PublicIndicator }) {
  if (indicator.status !== 'published') return <p className="mt-2 text-lg font-semibold text-ink-muted">Pas encore assez de données</p>;
  return (
    <>
      <p className="mt-2 font-display text-[2.25rem] leading-tight font-semibold text-petrol-900">
        {id === 'participants' ? indicator.value : `${indicator.value} %`}
      </p>
      {id === 'participants' ? null : <p className="text-sm text-ink-muted">{`Effectif : ${indicator.n}`}</p>}
    </>
  );
}

/** Page publique des indicateurs de résultats, affichée seulement si l'administrateur l'a activée. */
export default async function ResultsPage() {
  const results = await getPublicResults();
  if (!results) notFound();
  return (
    <>
      <PageHero
        title="Nos résultats"
        intro={`Période du ${formatDate(results.periodFrom, '—')} au ${formatDate(results.periodTo, '—')} · mis à jour le ${formatDate(results.computedAt)}.`}
      />
      <div className="bg-white py-14 sm:py-20">
        <div className="container-site">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ITEMS.map((item) => (
              <li key={item.key} className="rounded-lg border border-line bg-paper p-5">
                <h2 className="text-base font-semibold">{item.label}</h2>
                <Value id={item.key} indicator={results.indicators[item.key]} />
                <p className="mt-3 text-sm text-ink-subtle">{item.definition}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl text-sm text-ink-muted">
            {`Chiffres calculés automatiquement à partir des données de la plateforme. Un indicateur n’est publié que s’il porte sur au moins ${PUBLIC_MIN_N} personnes, pour qu’il soit significatif et qu’aucune personne ne soit identifiable.`}
          </p>
        </div>
      </div>
    </>
  );
}
