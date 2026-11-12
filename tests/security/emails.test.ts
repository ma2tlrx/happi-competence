/**
 * Droits sur la file d'e-mails (email_outbox) et les préférences (email_preferences) :
 * lecture de la file réservée aux administrateurs, aucune écriture avec une session,
 * réservation d'un lot réservée au serveur, préférences limitées à son propre compte.
 */
import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let participantA: Client;
let trainerA: Client;
let admin: Client;
let adminId: string;
const key = `securite:${randomBytes(4).toString('hex')}`;

beforeAll(async () => {
  f = await createFixtures();
  participantA = await signIn(f.accounts.participantA.email);
  trainerA = f.clients.trainerA;
  // Un administrateur temporaire : le formateur B promu le temps du test.
  adminId = f.accounts.trainerB.id;
  await service.from('profiles').update({ role: 'admin' }).eq('id', adminId);
  admin = await signIn(f.accounts.trainerB.email);
  const { error } = await service.from('email_outbox').insert({
    idempotency_key: key,
    template: 'session_reminder',
    recipient_email: f.accounts.participantA.email,
    recipient_user_id: f.accounts.participantA.id,
    participant_id: f.participantA,
    session_id: f.sessionA,
    subject: 'Rappel',
  });
  if (error) throw new Error(error.message);
});

afterAll(async () => {
  await service.from('email_outbox').delete().eq('idempotency_key', key);
  await service.from('profiles').update({ role: 'formateur' }).eq('id', adminId);
  await destroyFixtures(f);
});

describe('file d’e-mails', () => {
  it('n’est lisible ni par le participant ni par le formateur', async () => {
    for (const client of [participantA, trainerA]) {
      const { data } = await client.from('email_outbox').select('id').eq('idempotency_key', key);
      expect(data ?? []).toHaveLength(0);
    }
  });

  it('est lisible par l’administrateur', async () => {
    const { data, error } = await admin.from('email_outbox').select('id, status').eq('idempotency_key', key);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('refuse toute écriture avec une session, même administrateur', async () => {
    for (const client of [participantA, trainerA, admin]) {
      const insert = await client.from('email_outbox').insert({ idempotency_key: `${key}:x`, template: 'test', subject: 'X' });
      expect(insert.error).not.toBeNull();
      const update = await client.from('email_outbox').update({ status: 'sent' }).eq('idempotency_key', key).select('id');
      expect(update.data ?? []).toHaveLength(0);
    }
    const { data } = await service.from('email_outbox').select('status').eq('idempotency_key', key).single();
    expect(data?.status).toBe('queued');
  });

  it('réserve la réservation de lots au serveur', async () => {
    const { error } = await admin.rpc('claim_email_outbox', { p_limit: 1 });
    expect(error).not.toBeNull();
  });

  it('est purgée avec le participant (cascade)', async () => {
    const { data } = await service.from('email_outbox').select('participant_id').eq('idempotency_key', key).single();
    expect(data?.participant_id).toBe(f.participantA);
  });
});

describe('préférences d’e-mail', () => {
  it('chacun gère les siennes uniquement', async () => {
    const own = await participantA.from('email_preferences').upsert({ user_id: f.accounts.participantA.id, reminders: false }, { onConflict: 'user_id' });
    expect(own.error).toBeNull();
    const other = await participantA.from('email_preferences').insert({ user_id: f.accounts.participantB.id, reminders: false });
    expect(other.error).not.toBeNull();
    const { data: seenByTrainer } = await trainerA.from('email_preferences').select('user_id').eq('user_id', f.accounts.participantA.id);
    expect(seenByTrainer ?? []).toHaveLength(0);
    const { data: seenByAdmin } = await admin.from('email_preferences').select('reminders').eq('user_id', f.accounts.participantA.id).single();
    expect(seenByAdmin?.reminders).toBe(false);
  });
});
