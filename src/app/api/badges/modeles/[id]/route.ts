import { connection } from 'next/server';

import { notFoundJson, publicJson } from '@/lib/badges/public-json';
import { OB_CONTEXT, VC_CONTEXT } from '@/lib/badges/credential';
import { achievementOf, issuerInfo } from '@/lib/badges/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/utils';

/**
 * Description publique d'un modèle de badge (Achievement Open Badges 3.0), adresse inscrite
 * dans chaque badge émis. Seuls les modèles actifs ou déjà émis sont publiés ; aucun
 * renseignement sur les titulaires.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) return notFoundJson();
  const admin = createAdminClient();
  const [{ data: badgeClass }, { count }] = await Promise.all([
    admin.from('badge_classes').select('id, name, description, criteria_narrative, image_url, related_skills, is_active').eq('id', id).maybeSingle(),
    admin.from('badge_assertions').select('id', { count: 'exact', head: true }).eq('badge_class_id', id),
  ]);
  if (!badgeClass || !(badgeClass.is_active || (count ?? 0) > 0)) return notFoundJson();
  const achievement = achievementOf(badgeClass);
  const issuer = issuerInfo();
  return publicJson({
    '@context': [VC_CONTEXT, OB_CONTEXT],
    id: achievement.id,
    type: ['Achievement'],
    name: achievement.name,
    description: achievement.description,
    criteria: { narrative: achievement.criteriaNarrative },
    ...(achievement.imageUrl ? { image: { id: achievement.imageUrl, type: 'Image' } } : {}),
    ...(achievement.tags?.length ? { tag: achievement.tags } : {}),
    creator: { id: issuer.id, type: ['Profile'], name: issuer.name, url: issuer.url },
  });
}
