import packageJson from '../../../package.json';

export type DatabaseCheck = { ok: boolean; latencyMs: number };

/**
 * Vérifie l'accès à la base par l'appel le plus léger possible : la fonction
 * public.health_check() (un simple « select true », ouverte à la clé publique) via PostgREST.
 * Aucune table n'est lue ; délai maximal 3 s.
 */
export async function checkDatabase(timeoutMs = 3000): Promise<DatabaseCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const started = Date.now();
  if (!url || !key) return { ok: false, latencyMs: 0 };
  try {
    const response = await fetch(`${url}/rest/v1/rpc/health_check`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ok = response.ok && (await response.json()) === true;
    return { ok, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: Date.now() - started };
  }
}

/** Commit déployé : renseigné au build (next.config.ts) ou par l'hébergeur. */
export function deployedCommit() {
  const sha = process.env.APP_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '';
  return sha ? sha.slice(0, 12) : null;
}

/** Corps de la réponse de /api/health : jamais d'URL, de clé ni de message d'erreur détaillé. */
export function healthPayload(database: DatabaseCheck, now = new Date()) {
  return {
    status: database.ok ? ('ok' as const) : ('degraded' as const),
    version: packageJson.version,
    commit: deployedCommit(),
    time: now.toISOString(),
    checks: { database: { status: database.ok ? ('ok' as const) : ('error' as const), latencyMs: database.latencyMs } },
  };
}
