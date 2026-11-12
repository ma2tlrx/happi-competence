import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const enqueueReminders = vi.fn(async () => ({ date: '2026-11-13', sessions: 0, inserted: 0, duplicates: 0 }));
const processOutbox = vi.fn(async () => ({ claimed: 0, sent: 0, skipped: 0, failed: 0, retrying: 0 }));
vi.mock('@/lib/email/events', () => ({ enqueueReminders }));
vi.mock('@/lib/email/outbox', () => ({ processOutbox }));

const { GET } = await import('./route');
const { isAuthorizedCron } = await import('@/lib/email/cron-auth');

const SECRET = 'un-secret-de-test-suffisamment-long';
const call = (authorization?: string) =>
  GET(new Request('http://localhost:3106/api/cron/rappels', { headers: authorization ? { authorization } : {} }));

describe('route /api/cron/rappels', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('refuse un appel sans secret (401) et ne touche pas à la file', async () => {
    vi.stubEnv('CRON_SECRET', SECRET);
    expect((await call()).status).toBe(401);
    expect((await call('Bearer mauvais')).status).toBe(401);
    expect((await call(SECRET)).status).toBe(401);
    expect(enqueueReminders).not.toHaveBeenCalled();
    expect(processOutbox).not.toHaveBeenCalled();
  });

  it('refuse tout appel quand CRON_SECRET n’est pas défini', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await call('Bearer ')).status).toBe(401);
  });

  it('met en file les rappels puis vide la file avec le bon secret', async () => {
    vi.stubEnv('CRON_SECRET', SECRET);
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(enqueueReminders).toHaveBeenCalledOnce();
    expect(processOutbox).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({ ok: true, reminders: { date: '2026-11-13' } });
  });
});

describe('isAuthorizedCron', () => {
  it('compare le jeton exact et exige un secret assez long', () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isAuthorizedCron(`bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isAuthorizedCron(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isAuthorizedCron('Bearer court', 'court')).toBe(false);
    expect(isAuthorizedCron(null, SECRET)).toBe(false);
  });
});
