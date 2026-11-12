import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { siteConfig } from '@/config/site';
import { getPassport } from '@/lib/passport';
import { reportContentSchema } from '@/lib/report/content';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';

import { buildPublicPassport, type LatestFinalReport, type PublicPassport } from './public-view';
import { decryptShareToken, deriveShareKeys, hashIp, hashShareToken, type ShareKeys } from './token';

/**
 * Partage du passeport, côté serveur.
 *
 * Choix de sécurité pour la page publique : la résolution du jeton est faite par
 * public.consume_passport_share, exécutable par la seule clé de service (aucun
 * visiteur ne peut l'appeler directement avec la clé publique, ni contourner le
 * comptage et l'empreinte d'IP). Une fois le lien validé par la base, l'identifiant
 * du participant vient de la base — jamais de la requête — et le passeport est lu
 * par la fonction commune getPassport avec le client de service, dont chaque requête
 * est filtrée sur ce seul participant. La sortie passe ensuite par la liste blanche
 * buildPublicPassport. Ce module n'écrit jamais le jeton dans les journaux.
 */

let cachedKeys: ShareKeys | null = null;

/** Clés dérivées de PASSPORT_SHARE_SECRET, à défaut de la clé de service (toutes deux côté serveur uniquement). */
export function shareKeys(): ShareKeys {
  if (cachedKeys) return cachedKeys;
  const secret = process.env.PASSPORT_SHARE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Configuration manquante : PASSPORT_SHARE_SECRET (côté serveur uniquement).');
  cachedKeys = deriveShareKeys(secret);
  return cachedKeys;
}

/** Adresse publique du lien. L'origine officielle du site prime sur les en-têtes de la requête. */
export function shareUrl(token: string) {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || siteConfig.url).replace(/\/+$/, '');
  return `${origin}/verifier/${token}`;
}

/**
 * Jeton en clair d'un lien actif du participant connecté (copie, QR code, PDF).
 * La base ne renvoie le chiffré qu'au titulaire, pour un lien ni expiré ni révoqué.
 */
export async function revealShareToken(supabase: SupabaseClient<Database>, shareId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('my_passport_share_secret', { p_share_id: shareId });
  if (error || typeof data !== 'string') return null;
  return decryptShareToken(data, shareKeys().encryption);
}

type Consumed = { participant_id: string; include_sociocognitive: boolean; include_report: boolean; expires_at: string };

/** Durée minimale de toute réponse : un lien inconnu, expiré ou révoqué ne se distingue pas par le temps. */
export const MIN_RESOLVE_MS = 400;

/**
 * Résout un lien public. Renvoie null pour tout lien non valide (inconnu, mal formé,
 * expiré, révoqué) sans distinguer les cas. Compte la consultation si le lien est valide.
 */
export async function resolvePublicPassport(token: string, ip: string | null): Promise<PublicPassport | null> {
  const started = Date.now();
  let result: PublicPassport | null = null;
  try {
    result = await resolve(token, ip);
  } catch {
    // Erreur technique : réponse neutre, sans détail (et sans le jeton) dans les journaux.
    result = null;
  }
  const elapsed = Date.now() - started;
  if (elapsed < MIN_RESOLVE_MS) await new Promise((done) => setTimeout(done, MIN_RESOLVE_MS - elapsed));
  return result;
}

async function resolve(token: string, ip: string | null): Promise<PublicPassport | null> {
  const keys = shareKeys();
  const admin = createAdminClient();
  // Même chemin pour tout jeton, bien formé ou non : une empreinte, une requête.
  const { data, error } = await admin.rpc('consume_passport_share', {
    p_token_hash: hashShareToken(token),
    p_ip_hash: hashIp(ip, keys.ip) ?? undefined,
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null;
  const share = data as unknown as Consumed;
  return loadPublicPassport(admin, share.participant_id, {
    includeSociocognitive: share.include_sociocognitive === true,
    includeReport: share.include_report === true,
  }, share.expires_at);
}

/** Passeport public d'un participant dont le lien vient d'être validé par la base. */
export async function loadPublicPassport(
  client: SupabaseClient<Database>,
  participantId: string,
  options: { includeSociocognitive: boolean; includeReport: boolean },
  expiresAt: string,
): Promise<PublicPassport | null> {
  const [passport, report] = await Promise.all([
    getPassport(client, participantId),
    options.includeReport ? latestFinalReport(client, participantId) : Promise.resolve(null),
  ]);
  if (!passport || passport.participant.id !== participantId) return null;
  return buildPublicPassport(passport, options, { expiresAt }, report);
}

async function latestFinalReport(client: SupabaseClient<Database>, participantId: string): Promise<LatestFinalReport> {
  const { data } = await client
    .from('participant_reports')
    .select('version, finalized_at, content')
    .eq('participant_id', participantId)
    .eq('status', 'final')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const content = reportContentSchema.safeParse(data.content);
  return { version: data.version, finalizedAt: data.finalized_at, content: content.success ? content.data : null };
}
