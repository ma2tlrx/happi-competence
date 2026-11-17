import 'server-only';

import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';

/**
 * Quota commun à toutes les aides par IA (rédaction des bilans, version facile à lire,
 * structuration des notes de séance) : 10 demandes par compte et par heure, pour
 * maîtriser les coûts. Le décompte se fait à partir du journal d'activité, alimenté
 * par la base (déclencheurs et public.authorize_observation_assist).
 */
export const AI_HOURLY_QUOTA = 10;

export const AI_QUOTA_MESSAGE = `Limite atteinte : ${AI_HOURLY_QUOTA} demandes à l’IA par heure et par compte. Réessayez plus tard ou rédigez le texte à la main.`;

/** Demandes à l'IA enregistrées par ce compte depuis une heure. Sans clé de service, aucun décompte (0). */
export async function aiUsageLastHour(userId: string) {
  if (!isAdminClientConfigured()) return 0;
  const since = new Date(Date.now() - 3600_000).toISOString();
  const base = () => createAdminClient().from('audit_logs').select('id', { count: 'exact', head: true }).eq('actor_id', userId).gte('occurred_at', since);
  const [reports, easyReads, observations] = await Promise.all([
    base().eq('action', 'report.content_updated').eq('metadata->>content_source', 'ai'),
    base().eq('action', 'report.easy_read_created').eq('metadata->>content_source', 'ai'),
    base().eq('action', 'ai.observation_structured'),
  ]);
  return (reports.count ?? 0) + (easyReads.count ?? 0) + (observations.count ?? 0);
}

export async function aiQuotaReached(userId: string) {
  return (await aiUsageLastHour(userId)) >= AI_HOURLY_QUOTA;
}
