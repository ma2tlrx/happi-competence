import { Award, FileDown } from 'lucide-react';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, Notice, PageHeader } from '@/components/ui/primitives';
import { localImagePath } from '@/lib/badges/server';
import { formatDate } from '@/lib/utils';

import { getMyPassport } from '../data';

import { BadgeLink } from './badge-link';

export const metadata: Metadata = { title: 'Mes badges' };

export default async function MyBadgesPage() {
  const { passport, supabase } = await getMyPassport();
  const { data: rows } = await supabase
    .from('badge_assertions')
    .select('id, issued_at, revoked_at, groups ( name ), badge_classes ( name, description, criteria_narrative, image_url )')
    .eq('participant_id', passport.participant.id)
    .order('issued_at', { ascending: false });
  const badges = rows ?? [];

  return (
    <>
      <PageHeader
        title="Mes badges"
        description="Des badges numériques signés par HAPPI Compétence, au format Open Badges 3.0. Ils vous appartiennent : téléchargez-les, gardez-les et montrez-les à qui vous voulez."
      />
      <Notice className="mb-6" title="Comment les utiliser">
        Le fichier .jwt est votre badge signé, au format Open Badges 3.0 : il peut être importé dans un portefeuille numérique compatible (la version
        JSON contient le même badge signé). Le lien de vérification permet à un employeur ou à un organisme de contrôler en ligne que le badge est
        authentique et toujours valable. Il affiche votre prénom, l’initiale de votre nom et le badge, rien d’autre.
      </Notice>
      {badges.length > 0 ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {badges.map((row) => {
            const image = localImagePath(row.badge_classes?.image_url);
            return (
              <li key={row.id}>
                <Card className="flex h-full gap-4 p-5">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- image du badge, servie par le site
                    <img src={image} alt="" className="size-16 shrink-0 rounded-md border border-line bg-white object-contain p-1" />
                  ) : (
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-petrol-50 text-petrol-700">
                      <Award className="size-8" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-ink">{row.badge_classes?.name ?? 'Badge'}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-subtle">
                      Reçu le {formatDate(row.issued_at)}
                      {row.groups?.name ? ` · ${row.groups.name}` : ''}
                      {row.revoked_at ? <Badge variant="neutral">Révoqué le {formatDate(row.revoked_at)}</Badge> : <Badge variant="success">Valide</Badge>}
                    </p>
                    {row.badge_classes?.description ? <p className="mt-2 text-sm text-ink-muted">{row.badge_classes.description}</p> : null}
                    {row.revoked_at ? (
                      <p className="mt-3 text-sm text-ink-muted">Ce badge a été révoqué par l’équipe HAPPI : il n’est plus téléchargeable et sa page de vérification l’indique.</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild size="sm">
                          <a href={`/api/exports/badges/${row.id}?format=jwt`} download>
                            <FileDown aria-hidden />
                            Badge signé (.jwt)
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <a href={`/api/exports/badges/${row.id}?format=json`} download>
                            Version JSON
                          </a>
                        </Button>
                        <BadgeLink id={row.id} />
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <EmptyState icon={Award} title="Aucun badge pour le moment" description="Les badges sont attribués par l’équipe HAPPI. Vous serez prévenu dans vos notifications." />
        </Card>
      )}
    </>
  );
}
