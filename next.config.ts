import type { NextConfig } from 'next';

/** En-têtes de sécurité appliqués à toutes les réponses. */
const baseHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const securityHeaders = [
  ...baseHeaders,
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
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
  poweredByHeader: false,
  reactStrictMode: true,
  // Le moteur PDF s'exécute côté serveur uniquement et ne doit pas être empaqueté.
  serverExternalPackages: ['@react-pdf/renderer'],
  // Polices et logos lus sur le disque par les routes qui produisent des PDF.
  outputFileTracingIncludes: {
    '/api/exports/**': ['./public/fonts/report/**/*', './public/brand/**/*'],
  },
  async headers() {
    return [
      { source: '/((?!api/exports/bilan/).*)', headers: securityHeaders },
      { source: '/api/exports/bilan/:path*', headers: reportPreviewHeaders },
      // En dernier : remplace la Referrer-Policy générale pour ces pages.
      { source: '/verifier/:path*', headers: verificationHeaders },
    ];
  },
};

export default nextConfig;
