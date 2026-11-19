/**
 * Référentiels publics et correspondances (chantier F4) : lecture des référentiels pour tout
 * utilisateur connecté (jamais anonyme), écriture réservée à l'administrateur ; une
 * correspondance naît « proposée », n'est visible hors administration qu'une fois validée, et
 * seule une personne administratrice identifiée peut la valider (ni la clé de service, ni un
 * script). Une correspondance validée n'est pas réécrite en silence. Données fictives.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let admin: Client;
let adminId: string;
let participantA: Client;
let memberA: Client;
let trainerA: Client;
let externalFrameworkId: string;
let externalSkillId: string;
let otherExternalSkillId: string;
let frameworkId: string;
let skillCode: string;
let mappingId: string;

beforeAll(async () => {
  f = await createFixtures();
  trainerA = f.clients.trainerA;
  participantA = await signIn(f.accounts.participantA.email);
  memberA = await signIn(f.accounts.memberA.email);
  // Administrateur temporaire : le formateur B promu le temps du test.
  adminId = f.accounts.trainerB.id;
  await service.from('profiles').update({ role: 'admin' }).eq('id', adminId);
  admin = await signIn(f.accounts.trainerB.email);

  const skill = await service.from('skills').select('code, framework_versions ( framework_id )').eq('id', f.skillId).single();
  if (skill.error) throw new Error(skill.error.message);
  skillCode = skill.data.code;
  frameworkId = (skill.data.framework_versions as unknown as { framework_id: string }).framework_id;

  const framework = await admin
    .from('external_frameworks')
    .insert({ code: `test_${f.tag}`, name: 'Référentiel fictif', publisher: 'Tests', version: '0', source_url: 'https://example.org/fictif', license: 'Fictive', retrieved_on: '2026-11-19' })
    .select('id')
    .single();
  if (framework.error) throw new Error(framework.error.message);
  externalFrameworkId = framework.data.id;
  const items = await admin
    .from('external_skills')
    .insert([
      { framework_id: externalFrameworkId, code: 'F1', label: 'Élément fictif 1' },
      { framework_id: externalFrameworkId, code: 'F2', label: 'Élément fictif 2' },
    ])
    .select('id, code');
  if (items.error) throw new Error(items.error.message);
  externalSkillId = items.data.find((item) => item.code === 'F1')!.id;
  otherExternalSkillId = items.data.find((item) => item.code === 'F2')!.id;
});

afterAll(async () => {
  if (externalFrameworkId) await service.from('external_frameworks').delete().eq('id', externalFrameworkId);
  if (adminId) await service.from('profiles').update({ role: 'formateur' }).eq('id', adminId);
  await destroyFixtures(f);
});

describe('référentiels publics', () => {
  it('lisibles par tout utilisateur connecté, jamais par un visiteur anonyme', async () => {
    for (const client of [participantA, memberA, trainerA]) {
      const { data } = await client.from('external_skills').select('id').eq('framework_id', externalFrameworkId);
      expect(data).toHaveLength(2);
    }
    const anon = await anonymous().from('external_frameworks').select('id');
    expect(anon.data ?? []).toHaveLength(0);
  });

  it('écrits par l’administrateur seulement', async () => {
    for (const client of [participantA, memberA, trainerA]) {
      const insert = await client.from('external_skills').insert({ framework_id: externalFrameworkId, code: 'X', label: 'Intrus' });
      expect(insert.error).not.toBeNull();
      await client.from('external_skills').update({ label: 'Modifié' }).eq('id', externalSkillId);
      await client.from('external_frameworks').delete().eq('id', externalFrameworkId);
    }
    const check = await service.from('external_skills').select('label').eq('id', externalSkillId).single();
    expect(check.data?.label).toBe('Élément fictif 1');
    expect((await service.from('external_frameworks').select('id').eq('id', externalFrameworkId)).data).toHaveLength(1);
  });
});

describe('correspondances', () => {
  it('seul l’administrateur propose ; la proposition naît « proposée » et nominative', async () => {
    for (const client of [participantA, memberA, trainerA]) {
      const refused = await client.from('skill_mappings').insert({ framework_id: frameworkId, skill_code: skillCode, external_skill_id: externalSkillId, link_type: 'close' });
      expect(refused.error).not.toBeNull();
    }
    const forced = await admin
      .from('skill_mappings')
      .insert({ framework_id: frameworkId, skill_code: skillCode, external_skill_id: externalSkillId, link_type: 'close', status: 'validated' });
    expect(forced.error).not.toBeNull();
    const unknown = await admin.from('skill_mappings').insert({ framework_id: frameworkId, skill_code: 'competence_inexistante', external_skill_id: externalSkillId, link_type: 'close' });
    expect(unknown.error).not.toBeNull();
    const { data, error } = await admin
      .from('skill_mappings')
      .insert({ framework_id: frameworkId, skill_code: skillCode, external_skill_id: externalSkillId, link_type: 'close', proposed_by: f.accounts.participantA.id })
      .select('id, status, proposed_by, validated_at')
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: 'proposed', proposed_by: adminId, validated_at: null });
    mappingId = data!.id;
  });

  it('une proposition reste invisible hors administration', async () => {
    for (const client of [participantA, memberA, trainerA]) {
      const { data } = await client.from('skill_mappings').select('id').eq('id', mappingId);
      expect(data ?? []).toHaveLength(0);
    }
    expect((await admin.from('skill_mappings').select('id').eq('id', mappingId)).data).toHaveLength(1);
  });

  it('ni un non-administrateur ni la clé de service ne valident', async () => {
    for (const client of [participantA, memberA, trainerA]) {
      await client.from('skill_mappings').update({ status: 'validated' }).eq('id', mappingId);
      await client.from('skill_mappings').delete().eq('id', mappingId);
    }
    const byService = await service.from('skill_mappings').update({ status: 'validated' }).eq('id', mappingId);
    expect(byService.error).not.toBeNull();
    const byScript = await service
      .from('skill_mappings')
      .insert({ framework_id: frameworkId, skill_code: skillCode, external_skill_id: otherExternalSkillId, link_type: 'equivalent', status: 'validated' });
    expect(byScript.error).not.toBeNull();
    const check = await service.from('skill_mappings').select('status').eq('id', mappingId).single();
    expect(check.data?.status).toBe('proposed');
  });

  it('l’administrateur valide : horodatage et auteur posés par la base, puis visible de tous les connectés', async () => {
    const { data, error } = await admin
      .from('skill_mappings')
      .update({ status: 'validated', validated_by: f.accounts.participantA.id, validated_at: '2000-01-01T00:00:00Z' })
      .eq('id', mappingId)
      .select('status, validated_by, validated_at')
      .single();
    expect(error).toBeNull();
    expect(data!.status).toBe('validated');
    expect(data!.validated_by).toBe(adminId);
    expect(new Date(data!.validated_at!).getFullYear()).toBeGreaterThanOrEqual(2026);
    for (const client of [participantA, memberA, trainerA]) {
      const { data: visible } = await client.from('skill_mappings').select('id, status').eq('id', mappingId);
      expect(visible).toEqual([{ id: mappingId, status: 'validated' }]);
    }
    const audit = await service.from('audit_logs').select('action, actor_id').eq('entity_id', mappingId).order('id');
    expect(audit.data?.map((row) => row.action)).toEqual(['skill_mapping.proposed', 'skill_mapping.validated']);
    expect(audit.data?.[1]?.actor_id).toBe(adminId);
  });

  it('une correspondance validée ne change ni de type ni de cible sans repasser en « proposée »', async () => {
    expect((await admin.from('skill_mappings').update({ link_type: 'partial' }).eq('id', mappingId)).error).not.toBeNull();
    expect((await admin.from('skill_mappings').update({ external_skill_id: otherExternalSkillId }).eq('id', mappingId)).error).not.toBeNull();
    const back = await admin.from('skill_mappings').update({ status: 'proposed' }).eq('id', mappingId).select('status, validated_by').single();
    expect(back.data).toEqual({ status: 'proposed', validated_by: null });
    expect((await participantA.from('skill_mappings').select('id').eq('id', mappingId)).data ?? []).toHaveLength(0);
  });

  it('l’administrateur retire une correspondance (journalisé)', async () => {
    expect((await admin.from('skill_mappings').delete().eq('id', mappingId)).error).toBeNull();
    const audit = await service.from('audit_logs').select('action').eq('entity_id', mappingId).order('id', { ascending: false }).limit(1);
    expect(audit.data?.[0]?.action).toBe('skill_mapping.removed');
  });
});
