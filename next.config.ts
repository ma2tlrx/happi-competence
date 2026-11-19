import { execSync } from 'node:child_process';

import type { NextConfig } from 'next';

/** Commit construit, affiché par /api/health (Vercel le fournit ; ailleurs, lu dans Git s'il est présent). */
function buildCommit() {
  if (process.env.APP_COMMIT_SHA) return process.env.APP_COMMIT_SHA;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

/** En-têtes de sécurité appliqués à toutes les réponses. */
const baseHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

// Pages : la CSP (avec nonce, script-src strict) est posée à chaque requête par src/proxy.ts.
const securityHeaders = [...baseHeaders, { key: 'X-Frame-Options', value: 'DENY' }];

// Routes /api (JSON, CSV, PDF, ZIP) : aucune exécution de script attendue.
const apiHeaders = [
  ...securityHeaders,
  {
    key: 'Content-Security-Policy',
    value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  },
];

// L'aperçu du bilan s'affiche dans la page de l'application elle-même (cadre de même origine uniquement).
const reportPreviewHeaders = [
  ...baseHeaders,
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'" },
];

// Vérification publique d'un passeport partagé : le jeton est dans l'adresse. Il ne doit
// fuiter ni par l'en-tête Referer, ni par un cache partagé, ni par l'indexation.
const verificationHeaders = [
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
];

const nextConfig: NextConfig = {
  // Hébergement Node.js classique (LWS / Passenger) : NEXT_OUTPUT=standalone produit un serveur
  // autonome (.next/standalone, voir scripts/package-lws.mjs). Vercel garde sa sortie par défaut.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
  poweredByHeader: false,
  env: { APP_COMMIT_SHA: buildCommit() },
  reactStrictMode: true,
  // Le moteur PDF et le client SMTP s'exécutent côté serveur uniquement et ne doivent pas être empaquetés.
  serverExternalPackages: ['@react-pdf/renderer', 'nodemailer'],
  // Polices et logos lus sur le disque par les routes qui produisent des PDF.
  outputFileTracingIncludes: {
    '/api/exports/**': ['./public/fonts/report/**/*', './public/brand/**/*'],
  },
  // Anciennes adresses du site WordPress : redirection permanente (301) pour garder le référencement
  // et les liens déjà diffusés. Les pages du thème de démonstration (boutique, blog d'exemple,
  // portfolio, variantes d'accueil) n'avaient pas de contenu propre : elles renvoient vers l'accueil.
  async redirects() {
    const permanent = true;
    return [
      { source: '/contacts', destination: '/contact', permanent },
      { source: '/(about-us|history|mission|our-team|team|gallery)', destination: '/approche', permanent },
      { source: '/services', destination: '/programme', permanent },
      { source: '/(shop|shop-2|cart|checkout|my-account-2|wishlist-2)/:rest*', destination: '/', permanent },
      { source: '/(shop|shop-2|cart|checkout|my-account-2|wishlist-2)', destination: '/', permanent },
      { source: '/(product|portfolio|team|blog|category|tag|author)/:rest*', destination: '/', permanent },
      { source: '/:variant(blog-.+|portfolio-.+|masonry-.+|homepage-.+)', destination: '/', permanent },
      { source: '/(sample-page|page-d-exemple|typography|elements|coming-soon|mega-menu-page|bonjour-tout-le-monde)', destination: '/', permanent },
    ];
  },
  async headers() {
    return [
      { source: '/((?!api/).*)', headers: securityHeaders },
      { source: '/api/((?!exports/bilan/).*)', headers: apiHeaders },
      { source: '/api/exports/bilan/:path*', headers: reportPreviewHeaders },
      // En dernier : remplace la Referrer-Policy générale pour ces pages.
      { source: '/verifier/:path*', headers: verificationHeaders },
      { source: '/badges/verifier/:path*', headers: verificationHeaders },
    ];
  },
};

export default nextConfig;
