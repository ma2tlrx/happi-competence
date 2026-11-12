import { ArrowLeft, MessageSquareHeart } from 'lucide-react';
import Link from 'next/link';

import { PendingSurveysCard } from '@/components/satisfaction/pending-card';
import { SurveyForm } from '@/components/satisfaction/survey-form';
import { Badge, Card, EmptyState, Notice, PageHeader, ProvisionalBadge } from '@/components/ui/primitives';
import { loadMySurveys, loadSurveyForm } from '@/lib/satisfaction/load';
import { MOMENT_LABELS } from '@/lib/satisfaction/window';
import type { ServerClient } from '@/lib/supabase/server';
import { formatDate, isUuid } from '@/lib/utils';

/**
 * Page « Donnez votre avis », commune au participant et au prescripteur : liste des enquêtes
 * ouvertes, ou formulaire de l'enquête choisie. La base revérifie tout à l'envoi.
 */
export async function SatisfactionSurveyPage({
  supabase,
  basePath,
  params,
  audienceText,
}: {
  supabase: ServerClient;
  basePath: '/participant/satisfaction' | '/organisme/satisfaction';
  params: { groupe?: string; moment?: string; merci?: string };
  audienceText: string;
}) {
  const surveys = await loadMySurveys(supabase);
  const moment = params.moment === 'cold' ? 'cold' : params.moment === 'hot' ? 'hot' : null;
  const selected = isUuid(params.groupe) && moment ? surveys.find((survey) => survey.groupId === params.groupe && survey.moment === moment) : undefined;

  if (selected && !selected.answered) {
    const form = await loadSurveyForm(supabase, selected.versionId);
    if (form) {
      return (
        <>
          <PageHeader
            back={
              <Link href={basePath} className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink">
                <ArrowLeft className="size-4" aria-hidden />
                Mes enquêtes
              </Link>
            }
            title={<span className="flex flex-wrap items-center gap-3">{form.name}{form.isProvisional ? <ProvisionalBadge /> : null}</span>}
            description={`${selected.groupName} · ${selected.programName} · enquête ${MOMENT_LABELS[selected.moment].short}`}
          />
          {form.intro ? <p className="mb-5 max-w-2xl text-ink-muted">{form.intro}</p> : null}
          <SurveyForm survey={form} groupId={selected.groupId} moment={selected.moment} />
        </>
      );
    }
  }

  const answered = surveys.filter((survey) => survey.answered);
  return (
    <>
      <PageHeader title="Donnez votre avis" description={audienceText} />
      {params.merci ? (
        <Notice variant="success" className="mb-5" title="Merci pour votre réponse">
          Elle a bien été enregistrée. Elle aide l’équipe HAPPI à améliorer le programme.
        </Notice>
      ) : null}
      {selected?.answered || (params.groupe && !selected) ? (
        <Notice className="mb-5" title={selected?.answered ? 'Vous avez déjà répondu à cette enquête' : 'Enquête indisponible'}>
          {selected?.answered ? 'Une seule réponse est possible par personne.' : 'Cette enquête n’est pas ouverte pour vous en ce moment.'}
        </Notice>
      ) : null}
      <div className="space-y-5">
        <PendingSurveysCard surveys={surveys} basePath={basePath} />
        {surveys.every((survey) => survey.answered) ? (
          <Card>
            <EmptyState
              icon={MessageSquareHeart}
              title="Aucune enquête à remplir"
              description="L’enquête « à chaud » s’ouvre à la fin de la dernière séance du groupe ; l’enquête « à froid », 90 jours plus tard."
            />
          </Card>
        ) : null}
        {answered.length > 0 ? (
          <Card className="px-5 py-4">
            <p className="text-sm font-semibold text-ink">Déjà répondu</p>
            <ul className="mt-2 space-y-1.5 text-[0.9375rem] text-ink-muted">
              {answered.map((survey) => (
                <li key={`${survey.groupId}-${survey.moment}`} className="flex flex-wrap items-center gap-2">
                  {survey.groupName} · enquête {MOMENT_LABELS[survey.moment].short}
                  <Badge variant="success">Merci</Badge>
                  {survey.endDate ? <span className="text-sm text-ink-subtle">fin du programme : {formatDate(survey.endDate)}</span> : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
