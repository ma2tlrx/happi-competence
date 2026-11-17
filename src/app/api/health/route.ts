import { connection, NextResponse } from 'next/server';

import { checkDatabase, healthPayload } from '@/lib/ops/health';

/**
 * Sonde de disponibilité pour la supervision externe (UptimeRobot, Better Stack…) et l'hébergeur.
 * Publique, sans cache, sans aucune donnée personnelle ni configuration : état, version, commit.
 * 200 si la base répond, 503 sinon.
 */
export async function GET() {
  await connection();
  const database = await checkDatabase();
  const body = healthPayload(database);
  return NextResponse.json(body, {
    status: body.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Robots-Tag': 'noindex' },
  });
}
