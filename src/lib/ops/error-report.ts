/**
 * Journal structuré des erreurs serveur (src/instrumentation.ts → onRequestError).
 *
 * Une ligne JSON par erreur, sans donnée personnelle : ni en-têtes, ni cookies, ni corps de
 * requête, ni adresse réelle (seulement le gabarit de route, ex. /verifier/[token], car
 * l'adresse peut porter un jeton ou un identifiant). Les adresses e-mail et les jetons
 * éventuellement présents dans le message sont masqués.
 */
export type ErrorRequest = { path: string; method: string };
export type ErrorContext = { routerKind?: string; routePath?: string; routeType?: string; renderSource?: string };

export type ErrorLog = {
  level: 'error';
  time: string;
  event: 'server_error';
  name: string;
  message: string;
  digest: string | null;
  method: string;
  route: string | null;
  routeType: string | null;
  renderSource: string | null;
  commit: string | null;
};

const MAX_MESSAGE = 500;

/** Masque e-mails, jetons JWT, en-têtes Bearer et longues chaînes aléatoires. */
export function scrub(text: string) {
  return text
    .replace(/[^\s@"'<>()]+@[^\s@"'<>()]+\.[a-z]{2,}/gi, '[e-mail]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jeton]')
    .replace(/(bearer\s+)[\w.~+/=-]+/gi, '$1[jeton]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[jeton]');
}

export function buildErrorLog(error: unknown, request: ErrorRequest, context: ErrorContext, now = new Date(), commit: string | null = null): ErrorLog {
  const err = error instanceof Error ? error : null;
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? String((error as { digest: unknown }).digest) : null;
  const raw = err ? err.message : typeof error === 'string' ? error : 'Erreur non typée';
  return {
    level: 'error',
    time: now.toISOString(),
    event: 'server_error',
    name: err?.name ?? 'Error',
    message: scrub(raw).slice(0, MAX_MESSAGE),
    digest,
    method: request.method,
    route: context.routePath ?? null,
    routeType: context.routeType ?? null,
    renderSource: context.renderSource ?? null,
    commit,
  };
}

/** Pile d'appels réduite (fichiers et lignes, messages masqués) pour Sentry uniquement. */
export function scrubStack(error: unknown, maxLines = 20) {
  if (!(error instanceof Error) || !error.stack) return null;
  return scrub(error.stack.split('\n').slice(0, maxLines).join('\n'));
}

/** DSN Sentry : https://<clé publique>@<hôte>/<projet>. */
export function parseSentryDsn(dsn: string) {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.split('/').filter(Boolean).pop();
    if (!url.username || !projectId || !/^\d+$/.test(projectId)) return null;
    const prefix = url.pathname.slice(0, url.pathname.lastIndexOf(`/${projectId}`));
    return {
      publicKey: decodeURIComponent(url.username),
      endpoint: `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/`,
      dsn: `${url.protocol}//${url.username}@${url.host}${url.pathname}`,
    };
  } catch {
    return null;
  }
}

/**
 * Requête d'ingestion Sentry (format « envelope », sans SDK) : un événement par erreur, sans
 * utilisateur, sans en-têtes ni adresse IP (Sentry ne déduit pas l'IP d'un envoi serveur sans
 * champ user).
 */
export function sentryRequest(dsn: string, log: ErrorLog, stack: string | null, eventId: string, environment = 'production') {
  const parsed = parseSentryDsn(dsn);
  if (!parsed) return null;
  const event = {
    event_id: eventId,
    timestamp: log.time,
    platform: 'node',
    level: 'error',
    logger: 'happi.server',
    environment,
    release: log.commit ?? undefined,
    transaction: log.route ?? undefined,
    exception: { values: [{ type: log.name, value: log.message }] },
    tags: { route_type: log.routeType ?? 'inconnu', method: log.method },
    extra: { digest: log.digest, renderSource: log.renderSource, stack },
  };
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: parsed.dsn }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');
  return {
    url: parsed.endpoint,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=happi-competence/1.0`,
      },
      body,
    },
  };
}
