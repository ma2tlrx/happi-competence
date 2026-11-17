/**
 * Exploitation (migration 20261116110000_platform_ops) : la sonde de santé est ouverte à tous
 * sans rien lire ; l'export de réversibilité est réservé à l'administrateur, limité au périmètre
 * demandé (un organisme ne reçoit jamais les participants d'un autre), sans empreinte d'IP, et journalisé.
 */
import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let adminClient: Client;
let adminId: string;

type ExportRows = Record<string, Record<string, unknown>[]>;

beforeAll(async () => {
  f = await createFixtures();
  const email = `admin.ops.${f.tag}@securite.happi.test`;
  const password = `Adm-${randomBytes(12).toString('base64url')}9`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { account_type: 'pro', first_name: 'Admin', last_name: 'Ops' } });
  adminId = created.data.user!.id;
  await service.from('profiles').update({ role: 'admin' }).eq('id', adminId);
  adminClient = anonymous();
  await adminClient.auth.signInWithPassword({ email, password });
});

afterAll(async () => {
  await destroyFixtures(f);
  if (adminId) await service.auth.admin.deleteUser(adminId);
});

describe('sonde de santé', () => {
  it('répond à la clé publique', async () => {
    const { data, error } = await anonymous().rpc('health_check');
    expect(error).toBeNull();
    expect(data).toBe(true);
  });
});

describe('export de réversibilité', () => {
  it('est refusé à l’anonyme, au participant, au formateur et à l’organisme', async () => {
    const clients = [
      anonymous(),
      await signIn(f.accounts.participantA.email),
      f.clients.trainerA,
      await signIn(f.accounts.memberA.email),
    ];
    for (const client of clients) {
      const own = await client.rpc('export_platform_data', { p_organization_id: f.orgA });
      expect(own.data).toBeNull();
      expect(own.error).not.toBeNull();
      expect((await client.rpc('export_platform_data', {})).error).not.toBeNull();
    }
  });

  it('se limite aux participants de l’organisme et n’expose aucune empreinte d’IP', async () => {
    const { data, error } = await adminClient.rpc('export_platform_data', { p_organization_id: f.orgA });
    expect(error).toBeNull();
    const payload = data as unknown as { scope: string; data: ExportRows };
    expect(payload.scope).toBe('organisme');
    const participants = payload.data.participants.map((row) => row.id);
    expect(participants).toContain(f.participantA);
    expect(participants).not.toContain(f.participantB);
    for (const table of ['presences', 'evaluations_validees', 'inscriptions_groupes', 'emargements', 'situations', 'bilans_finaux']) {
      for (const row of payload.data[table]) expect(row.participant_id).not.toBe(f.participantB);
    }
    expect(payload.data.evaluations_validees.map((row) => row.id)).toContain(f.evaluationA);
    expect(payload.data.groupes.map((row) => row.id)).not.toContain(f.groupB);
    expect(JSON.stringify(payload)).not.toMatch(/ip_hmac|user_agent/);
  });

  it('exporte toute la plateforme pour l’administrateur et journalise chaque export', async () => {
    const { data, error } = await adminClient.rpc('export_platform_data', {});
    expect(error).toBeNull();
    const payload = data as unknown as { scope: string; data: ExportRows };
    expect(payload.scope).toBe('plateforme');
    const participants = payload.data.participants.map((row) => row.id);
    expect(participants).toEqual(expect.arrayContaining([f.participantA, f.participantB]));

    const { data: logs } = await service
      .from('audit_logs')
      .select('action, organization_id, metadata')
      .eq('actor_id', adminId)
      .in('action', ['export.organization_data', 'export.platform_data']);
    expect(logs?.map((row) => row.action).sort()).toEqual(['export.organization_data', 'export.platform_data']);
    expect(logs?.find((row) => row.action === 'export.organization_data')?.organization_id).toBe(f.orgA);
  });

  it('signale un organisme inconnu', async () => {
    const { error } = await adminClient.rpc('export_platform_data', { p_organization_id: '00000000-0000-4000-8000-000000000000' });
    expect(error?.code).toBe('P0002');
  });
});
