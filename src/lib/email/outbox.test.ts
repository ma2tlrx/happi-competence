import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ after: vi.fn() }));

// Faux client Supabase : reproduit l'insertion « on conflict do nothing » sur la clé d'idempotence.
const table = new Map<string, Record<string, unknown>>();
const notifications: Record<string, unknown>[] = [];
const fakeClient = {
  from(name: string) {
    if (name === 'notifications') return { insert: async (rows: Record<string, unknown>[]) => (notifications.push(...rows), { error: null }) };
    return {
      upsert(rows: Record<string, unknown>[]) {
        const inserted: { idempotency_key: string }[] = [];
        for (const row of rows) {
          const key = row.idempotency_key as string;
          if (table.has(key)) continue;
          table.set(key, row);
          inserted.push({ idempotency_key: key });
        }
        return { select: async () => ({ data: inserted, error: null }) };
      },
    };
  },
};

const { enqueueEmails, skipReasonFor, SKIP_REASONS } = await import('./outbox');

const input = (key: string, extra: Record<string, unknown> = {}) => ({
  key,
  template: 'session_reminder' as const,
  data: { sessionNumber: 1, firstName: 'Léa' },
  to: 'Lea@Exemple.fr',
  userId: 'u1',
  notification: { type: 'session.reminder', title: 'Rappel' },
  ...extra,
});

describe('file d’envoi', () => {
  beforeEach(() => {
    table.clear();
    notifications.length = 0;
  });

  it('n’ajoute jamais deux fois la même clé, ni la notification associée', async () => {
    const client = fakeClient as never;
    expect(await enqueueEmails([input('reminder:s:p:2026-11-20')], client)).toEqual({ inserted: 1, duplicates: 0 });
    expect(await enqueueEmails([input('reminder:s:p:2026-11-20'), input('reminder:s:p2:2026-11-20')], client)).toEqual({ inserted: 1, duplicates: 1 });
    expect(table.size).toBe(2);
    expect(notifications).toHaveLength(2);
  });

  it('normalise l’adresse et enregistre le sujet', async () => {
    await enqueueEmails([input('k1')], fakeClient as never);
    expect(table.get('k1')).toMatchObject({ recipient_email: 'lea@exemple.fr', status: 'queued', subject: expect.stringContaining('Rappel') });
  });

  it('marque « skipped » la démonstration, l’absence d’adresse et les rappels désactivés', async () => {
    await enqueueEmails(
      [input('demo', { isDemo: true }), input('sans', { to: null }), input('pref', { skipReason: SKIP_REASONS.remindersOff })],
      fakeClient as never,
    );
    expect(table.get('demo')).toMatchObject({ status: 'skipped', last_error: SKIP_REASONS.demo, is_demo: true });
    expect(table.get('sans')).toMatchObject({ status: 'skipped', last_error: SKIP_REASONS.noAddress });
    expect(table.get('pref')).toMatchObject({ status: 'skipped', last_error: SKIP_REASONS.remindersOff });
    // La notification in-app reste créée : seule l'adresse e-mail est concernée par ces règles.
    expect(notifications).toHaveLength(3);
  });

  it('donne la priorité à la démonstration sur toute autre raison', () => {
    expect(skipReasonFor({ isDemo: true, to: null, skipReason: 'x' })).toBe(SKIP_REASONS.demo);
    expect(skipReasonFor({ to: 'a@b.fr' })).toBeNull();
  });
});
