import type { Metadata } from 'next';

import { SatisfactionResults } from '@/components/satisfaction/results-view';
import { SatisfactionSurveyPage } from '@/components/satisfaction/survey-page';
import { FilterSelect } from '@/components/ui/navigation';
import { requireRole } from '@/lib/auth/session';
import { loadSatisfactionResults } from '@/lib/satisfaction/load';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'Satisfaction' };

export default async function OrganizationSatisfactionPage({
  searchParams,
}: {
  searchParams: Promise<{ groupe?: string; moment?: string; merci?: string; resultats?: string }>;
}) {
  const user = await requireRole('organisme');
  const params = await searchParams;
  const supabase = await createClient();
  const answering = isUuid(params.groupe) && (params.moment === 'hot' || params.moment === 'cold');
  // Résultats : seuls les groupes de la structure (la base filtre), présentés de façon agrégée.
  const { data: groups } = answering
    ? { data: [] }
    : await supabase.from('groups').select('id, name').eq('organization_id', user.organization!.id).order('start_date', { ascending: false });
  const selected = (groups ?? []).find((group) => group.id === params.resultats);
  const ids = selected ? [selected.id] : (groups ?? []).map((group) => group.id);
  const { summaries } = await loadSatisfactionResults(supabase, ids);

  return (
    <>
      <SatisfactionSurveyPage
        supabase={supabase}
        basePath="/organisme/satisfaction"
        params={params}
        audienceText="Votre avis de prescripteur sur le programme suivi par les personnes orientées, à la fin puis trois mois après."
      />
      {!answering ? (
        <section className="mt-10" aria-labelledby="resultats-titre">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="resultats-titre" className="text-[1.25rem] font-semibold tracking-[-0.01em]">
                Résultats pour vos groupes
              </h2>
              <p className="text-sm text-ink-muted">Résultats regroupés et anonymes. Les commentaires libres n’apparaissent qu’à partir de 3 réponses par groupe.</p>
            </div>
            {(groups ?? []).length > 1 ? (
              <FilterSelect
                param="resultats"
                label="Groupe"
                allLabel="Tous les groupes"
                options={(groups ?? []).map((group) => ({ value: group.id, label: group.name }))}
              />
            ) : null}
          </div>
          <SatisfactionResults summaries={summaries} />
        </section>
      ) : null}
    </>
  );
}
