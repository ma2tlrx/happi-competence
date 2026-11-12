/**
 * Limitation de débit et double authentification :
 * - public.rate_limit_hit n'est appelable qu'avec la clé de service ;
 * - les compteurs (schéma private) ne sont pas lisibles par l'API ;
 * - le paramètre « exiger la double authentification » retire, au niveau de la base,
 *   les droits d'un formateur dont la session n'est pas en aal2.
 */
import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Fixtures } from './fixtures';

let f: Fixtures;
const keyHash = randomBytes(32).toString('hex');
const action = `test_${randomBytes(3).toString('hex').replace(/\d/g, 'x')}.ip`;
const args = { p_action: action, p_key_hash: keyHash, p_limit: 2, p_window_seconds: 600 };

beforeAll(async () => {
  f = await createFixtures();
});

afterAll(async () => {
  await service.from('app_settings').update({ value: false }).eq('key', 'security.mfa_required_staff');
  await destroyFixtures(f);
});

describe('limitation de débit', () => {
  it('un visiteur anonyme ne peut pas appeler rate_limit_hit', async () => {
    const { data, error } = await anonymous().rpc('rate_limit_hit', args);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('un compte connecté ne peut pas appeler rate_limit_hit', async () => {
    const { data, error } = await f.clients.trainerA.rpc('rate_limit_hit', args);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
    const participant = await signIn(f.accounts.participantA.email);
    expect((await participant.rpc('rate_limit_hit', args)).error).not.toBeNull();
  });

  it('la clé de service compte les tentatives et refuse au-delà de la limite', async () => {
    const results = [];
    for (let index = 0; index < 3; index += 1) results.push((await service.rpc('rate_limit_hit', args)).data as { allowed: boolean; retry_after: number });
    expect(results.map((result) => result.allowed)).toEqual([true, true, false]);
    expect(results[2]!.retry_after).toBeGreaterThan(0);
  });

  it('les paramètres invalides sont refusés', async () => {
    expect((await service.rpc('rate_limit_hit', { ...args, p_key_hash: 'pas-une-empreinte' })).error).not.toBeNull();
    expect((await service.rpc('rate_limit_hit', { ...args, p_window_seconds: 100000 })).error).not.toBeNull();
  });

  it('les compteurs ne sont pas exposés par l’API', async () => {
    const table = anonymous().schema('private' as never).from('rate_limit_counters' as never).select('*');
    expect((await table).error).not.toBeNull();
  });
});

describe('double authentification', () => {
  it('my_mfa_status est réservée aux comptes connectés', async () => {
    expect((await anonymous().rpc('my_mfa_status')).error).not.toBeNull();
    const { data, error } = await f.clients.trainerA.rpc('my_mfa_status');
    expect(error).toBeNull();
    expect(data).toEqual({ aal: 'aal1', verified: false, required: false });
  });

  it('exigée pour les formateurs, elle retire leurs droits tant que la session est en aal1', async () => {
    const before = await f.clients.trainerA.from('groups').select('id').eq('id', f.groupA);
    expect(before.data).toHaveLength(1);

    expect((await service.from('app_settings').update({ value: true }).eq('key', 'security.mfa_required_staff')).error).toBeNull();
    const status = await f.clients.trainerA.rpc('my_mfa_status');
    expect(status.data).toMatchObject({ required: true, verified: false });
    expect((await f.clients.trainerA.from('groups').select('id').eq('id', f.groupA)).data).toEqual([]);

    // Un participant n'est pas concerné.
    const participant = await signIn(f.accounts.participantA.email);
    expect((await participant.rpc('my_mfa_status')).data).toMatchObject({ required: false });

    await service.from('app_settings').update({ value: false }).eq('key', 'security.mfa_required_staff');
    expect((await f.clients.trainerA.from('groups').select('id').eq('id', f.groupA)).data).toHaveLength(1);
  });

  it('un compte ne peut pas modifier le paramètre lui-même', async () => {
    await f.clients.trainerA.from('app_settings').update({ value: false }).eq('key', 'security.mfa_required_staff');
    const { data } = await service.from('app_settings').select('value').eq('key', 'security.mfa_required_staff').single();
    expect(data?.value).toBe(false);
  });
});
