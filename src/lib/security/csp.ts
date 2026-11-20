/**
 * Politique de sécurité du contenu (CSP) des pages, construite à chaque requête par
 * src/proxy.ts avec un nonce aléatoire. Next.js lit le nonce dans l'en-tête de la requête
 * et l'ajoute lui-même à ses scripts (voir node_modules/next/dist/docs, guide
 * « content-security-policy »).
 *
 * - script-src : nonce + 'strict-dynamic' — aucun script en ligne injecté ne s'exécute ;
 *   'unsafe-eval' seulement en développement (piles d'erreurs de React).
 * - style-src : 'unsafe-inline' conservé. Les attributs style (animations de la vitrine,
 *   graphiques Recharts, Motion) et les balises <style> posées par Radix ne portent pas de
 *   nonce. Une injection de style est sans commune mesure avec une injection de script.
 * - connect-src : origine Supabase en https et en wss (Realtime des jeux d'animation, avec relecture régulière en repli).
 * - frame-src 'self' : aperçu PDF du bilan (même origine) ; img-src data:/blob: : QR codes,
 *   signatures et images optimisées.
 */
export type CspOptions = {
  nonce: string;
  isDev?: boolean;
  /** Origine Supabase (appels éventuels depuis le navigateur). */
  supabaseUrl?: string;
};

export function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function originOf(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function buildCsp({ nonce, isDev = false, supabaseUrl }: CspOptions) {
  const supabase = originOf(supabaseUrl);
  // Temps réel des jeux : WebSocket Supabase (même hôte, wss://). Rien ne doit en dépendre : les écrans relisent l'état régulièrement.
  const realtime = supabase?.startsWith('https://') ? supabase.replace(/^https:/, 'wss:') : null;
  const connect = ["'self'", supabase, realtime, isDev ? 'ws:' : null].filter(Boolean).join(' ');
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "media-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    isDev ? null : 'upgrade-insecure-requests',
  ];
  return directives.filter(Boolean).join('; ');
}
