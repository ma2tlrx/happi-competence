import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        // Tests unitaires des modules purs (moteur d'évaluation, analyseur Markdown, exports).
        resolve: { alias },
        test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] },
      },
      {
        // Tests d'isolation exécutés contre la pile Supabase locale (npm run db:start).
        // « server-only » neutralisé : certains tests appellent directement les modules serveur.
        resolve: { alias: { ...alias, 'server-only': fileURLToPath(new URL('./tests/security/server-only-stub.ts', import.meta.url)) } },
        test: {
          name: 'security',
          environment: 'node',
          include: ['tests/security/**/*.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
