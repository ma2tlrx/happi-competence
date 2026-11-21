import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ParticipantFile } from '@/components/passport/participant-file';
import { FinalReports } from '@/components/report/final-reports';
import { Notice } from '@/components/ui/primitives';
import { hasPermission, requireRole } from '@/lib/auth/session';
import { getPassport } from '@/lib/passport';
import { listReports } from '@/lib/report/load';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'Résultats' };

/**
 * Résultats d'un participant vus par sa structure : bilans validés et passeport de compétences. Les situations
 * de sortie, la fiche d'entrée FSE+ et l'analyse du besoin restent côté équipe pédagogique et administration.
 * Le retour mène à la page du groupe d'origine (?groupe=…) quand ce groupe est visible, sinon à « Mes groupes ».
 */
export default async function OrganizationParticipantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ groupe?: string | string[] }>;
}) {
  const [{ id }, { groupe }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const user = await requireRole('organisme');
  const supabase = await createClient();
  const fromGroup = typeof groupe === 'string' && isUuid(groupe) ? groupe : null;
  // RLS : la fiche n'est renvoyée que si le participant est rattaché à la structure de l'utilisateur ;
  // le groupe d'origine n'est retenu que s'il est visible par la structure.
  const [passport, reports, origin] = await Promise.all([
    getPassport(supabase, id),
    listReports(supabase, id),
    fromGroup ? supabase.from('groups').select('id, name').eq('id', fromGroup).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!passport) notFound();
  await supabase.rpc('log_event', { p_action: 'participant_file.viewed', p_entity_type: 'participant', p_entity_id: id });
  const back = origin.data ? { href: `/organisme/groupes/${origin.data.id}`, label: origin.data.name } : { href: '/organisme/dashboard', label: 'Mes groupes' };

  return (
    <ParticipantFile
      passport={passport}
      canDownload={hasPermission(user, 'org.exports')}
      canCertify={hasPermission(user, 'org.exports') && hasPermission(user, 'org.attendance.read')}
      back={
        <Link href={back.href} className="inline-flex min-h-8 items-center gap-1.5 text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      }
      intro={
        <>
          {!hasPermission(user, 'org.evaluations.read') ? (
            <Notice variant="warning" className="mb-4" title="Évaluations non partagées">
              Votre structure n’a pas accès aux évaluations détaillées.
            </Notice>
          ) : null}
          <FinalReports reports={reports} canDownload={hasPermission(user, 'org.exports')} />
        </>
      }
    />
  );
}
