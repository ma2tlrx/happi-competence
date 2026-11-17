import type { Instrumentation } from 'next';

import { buildErrorLog, scrubStack, sentryRequest } from '@/lib/ops/error-report';

/**
 * Erreurs serveur (rendu, routes, actions, proxy) : une ligne JSON sur la sortie d'erreur,
 * lisible par les journaux de Vercel ou de l'hébergeur. Sans donnée personnelle (voir
 * src/lib/ops/error-report.ts). Envoi à Sentry uniquement si SENTRY_DSN est défini, par
 * l'API HTTP d'ingestion (aucun SDK) ; un échec d'envoi n'interrompt jamais la requête.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const commit = (process.env.APP_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 12) || null;
  const log = buildErrorLog(error, { path: request.path, method: request.method }, context, new Date(), commit);
  console.error(JSON.stringify(log));

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const outgoing = sentryRequest(dsn, log, scrubStack(error), crypto.randomUUID().replaceAll('-', ''), process.env.SENTRY_ENVIRONMENT ?? 'production');
  if (!outgoing) return;
  try {
    await fetch(outgoing.url, { ...outgoing.init, signal: AbortSignal.timeout(2000) });
  } catch {
    // Supervision indisponible : la ligne de journal ci-dessus suffit.
  }
};
