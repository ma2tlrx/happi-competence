import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'next-env.d.ts',
    'src/lib/supabase/database.types.ts',
    'playwright-report/**',
    'test-results/**',
    '.claude/**',
    'video/**',
    'graphify-out/**',
    // Fichiers tiers livrés tels quels (bibliothèque PDF) et application d'origine du Passeport Numérique.
    'public/passeport-numerique/**',
    'private/**',
  ]),
]);

export default eslintConfig;
