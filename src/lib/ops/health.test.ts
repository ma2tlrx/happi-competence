import { describe, expect, it } from 'vitest';

import { healthPayload } from './health';

describe('sonde de santé', () => {
  it('ne publie que l’état, la version et le commit', () => {
    const body = healthPayload({ ok: true, latencyMs: 12 }, new Date('2026-11-16T10:00:00Z'));
    expect(body.status).toBe('ok');
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Object.keys(body).sort()).toEqual(['checks', 'commit', 'status', 'time', 'version']);
    expect(JSON.stringify(body)).not.toMatch(/supabase|key|http/i);
  });

  it('signale une base indisponible', () => {
    expect(healthPayload({ ok: false, latencyMs: 3000 }).status).toBe('degraded');
  });
});
