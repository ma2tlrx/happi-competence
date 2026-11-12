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

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Le moteur PDF et le client SMTP s'exécutent côté serveur uniquement et ne doivent pas être empaquetés.
  serverExternalPackages: ['@react-pdf/renderer', 'nodemailer'],
  // Polices et logos lus sur le disque par les routes qui produisent des PDF.
  outputFileTracingIncludes: {
    '/api/exports/**': ['./public/fonts/report/**/*', './public/brand/**/*'],
  },
  async headers() {
    return [
      { source: '/((?!api/exports/bilan/).*)', headers: securityHeaders },
      { source: '/api/exports/bilan/:path*', headers: reportPreviewHeaders },
    ];
  },
};

export default nextConfig;
