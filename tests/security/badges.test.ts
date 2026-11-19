/**
 * Open Badges (badge_classes, badge_assertions) : seuls les administrateurs gèrent les
 * modèles, émettent et révoquent ; le participant lit ses badges et télécharge les siens ;
 * le formateur lit ceux de ses participants ; ni le jeton public ni le crédential ne sortent
 * en clair ; la vérification publique contrôle signature et révocation.
 */
import { generateKeyPairSync, randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { credentialSha256 } from '@/lib/badges/credential';
import { badgeUrls, resolvePublicBadge, revealCredential, signAndIssueBadge, verificationUrlOf } from '@/lib/badges/server';
import { hashShareToken } from '@/lib/passport-share/token';

import { anonymous, createFixtures, destroyFixtures, env, service, signIn, type Client, type Fixtures } from './fixtures';

// Clé de signature générée pour ce test : aucune clé réelle n'est utilisée ni versionnée.
process.env.OPEN_BADGES_SIGNING_KEY = JSON.stringify(generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'jwk' }));
process.env.OPEN_BADGES_STORAGE_SECRET = 'secret-de-stockage-des-tests-de-securite';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= env.url;
process.env.SUPABASE_SERVICE_ROLE_KEY ??= env.service;

let f: Fixtures;
let participantA: Client;
let participantB: Client;
let trainerA: Client;
let trainerB: Client;
let memberA: Client;
let adminClient: Client;
let adminId: string;
let classId: string;
let assertionId: string;
let token: string;

const badgeClassRow = () => ({ id: classId, name: 'Badge de test sécurité', description: 'Description du badge de test', criteria_narrative: 'Critère validé de test', image_url: null, related_skills: [] });

beforeAll(async () => {
  f = await createFixtures();
  participantA = await signIn(f.accounts.participantA.email);
  participantB = await signIn(f.accounts.participantB.email);
  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  memberA = await signIn(f.accounts.memberA.email);
  const email = `admin.badges.${f.tag}@securite.happi.test`;
  const password = `Adm-${randomBytes(12).toString('base64url')}9`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { account_type: 'pro', first_name: 'Admin', last_name: 'Test' } });
  adminId = created.data.user!.id;
  await service.from('profiles').update({ role: 'admin' }).eq('id', adminId);
  adminClient = anonymous();
  await adminClient.auth.signInWithPassword({ email, password });
});

afterAll(async () => {
  if (classId) await service.from('badge_assertions').delete().eq('badge_class_id', classId);
  if (classId) await service.from('badge_classes').delete().eq('id', classId);
  await destroyFixtures(f);
  if (adminId) await service.auth.admin.deleteUser(adminId);
});

describe('badges : modèles', () => {
  it('ni participant, ni formateur, ni organisme, ni anonyme ne crée de modèle', async () => {
    const row = { name: 'Faux badge', description: 'Description fausse', criteria_narrative: 'Critère faux test' };
    for (const client of [participantA, trainerA, memberA, anonymous()]) expect((await client.from('badge_classes').insert(row)).error).not.toBeNull();
  });

  it('l’administrateur crée un modèle ; provisoire, il ne peut pas être activé', async () => {
    const { data, error } = await adminClient.from('badge_classes').insert({ name: 'Badge de test sécurité', description: 'Description du badge de test', criteria_narrative: 'Critère validé de test' }).select('id, is_active, is_provisional').single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ is_active: false, is_provisional: true });
    classId = data!.id;
    expect((await adminClient.from('badge_classes').update({ is_active: true }).eq('id', classId)).error).not.toBeNull();
    expect((await adminClient.from('badge_classes').update({ is_active: true, is_provisional: false }).eq('id', classId)).error).toBeNull();
  });

  it('le modèle par défaut existe, inactif et provisoire', async () => {
    const { data } = await service.from('badge_classes').select('is_active, is_provisional').eq('name', 'Participation au programme HAPPI');
    expect(data?.length).toBeGreaterThan(0);
    expect(data![0]).toMatchObject({ is_active: false, is_provisional: true });
  });
});

describe('badges : émission', () => {
  it('formateur, participant et organisme ne peuvent pas émettre', async () => {
    for (const client of [trainerA, participantA, memberA]) {
      const result = await signAndIssueBadge(client, {
        badgeClass: badgeClassRow(),
        participant: { id: f.participantA, firstName: 'Participanta', lastName: 'Test' },
        groupId: f.groupA,
        snapshot: {},
      });
      expect(result.ok).toBe(false);
    }
  });

  it('l’administrateur émet ; la base ne garde ni le jeton ni le crédential en clair', async () => {
    const result = await signAndIssueBadge(adminClient, {
      badgeClass: badgeClassRow(),
      participant: { id: f.participantA, firstName: 'Participanta', lastName: 'Test' },
      groupId: f.groupA,
      snapshot: { mode: 'manual' },
    });
    expect(result.ok).toBe(true);
    assertionId = result.ok ? result.id : '';
    const jwt = await revealCredential(adminClient, assertionId);
    expect(jwt).toBeTruthy();
    const url = verificationUrlOf(jwt!);
    expect(url).toBeTruthy();
    token = url!.split('/').at(-1)!;
    const { data: row } = await service.from('badge_assertions').select('*').eq('id', assertionId).single();
    expect(row).toMatchObject({ participant_id: f.participantA, public_id_hash: hashShareToken(token), credential_sha256: credentialSha256(jwt!), issued_by: adminId });
    expect(JSON.stringify(row)).not.toContain(token);
    expect(JSON.stringify(row)).not.toContain(jwt!.split('.')[2]!);
  });

  it('un second badge valide du même modèle est refusé ; un groupe d’un autre participant aussi', async () => {
    const input = { badgeClass: badgeClassRow(), participant: { id: f.participantA, firstName: 'A', lastName: 'Test' }, groupId: f.groupA, snapshot: {} };
    expect((await signAndIssueBadge(adminClient, input)).ok).toBe(false);
    expect((await signAndIssueBadge(adminClient, { ...input, participant: { id: f.participantB, firstName: 'B', lastName: 'Test' } })).ok).toBe(false);
  });

  it('un modèle inactif ne s’émet pas', async () => {
    await adminClient.from('badge_classes').update({ is_active: false }).eq('id', classId);
    const result = await signAndIssueBadge(adminClient, { badgeClass: badgeClassRow(), participant: { id: f.participantB, firstName: 'B', lastName: 'Test' }, groupId: f.groupB, snapshot: {} });
    expect(result.ok).toBe(false);
    await adminClient.from('badge_classes').update({ is_active: true }).eq('id', classId);
  });
});

describe('badges : lecture', () => {
  it('colonnes secrètes illisibles pour tous les clients', async () => {
    for (const client of [adminClient, participantA, trainerA]) {
      expect((await client.from('badge_assertions').select('public_id_hash')).error).not.toBeNull();
      expect((await client.from('badge_assertions').select('credential_ciphertext')).error).not.toBeNull();
    }
  });

  it('le titulaire et son formateur voient le badge ; l’autre participant, l’autre formateur et l’organisme non', async () => {
    const count = async (client: Client) => (await client.from('badge_assertions').select('id').eq('id', assertionId)).data?.length ?? 0;
    expect(await count(participantA)).toBe(1);
    expect(await count(trainerA)).toBe(1);
    expect(await count(adminClient)).toBe(1);
    expect(await count(participantB)).toBe(0);
    expect(await count(trainerB)).toBe(0);
    expect(await count(memberA)).toBe(0);
    expect((await anonymous().from('badge_assertions').select('id')).data ?? []).toHaveLength(0);
  });

  it('seul le titulaire (ou un administrateur) obtient le crédential signé', async () => {
    expect(await revealCredential(participantA, assertionId)).toBeTruthy();
    expect(await revealCredential(participantB, assertionId)).toBeNull();
    expect(await revealCredential(trainerA, assertionId)).toBeNull();
    expect(await revealCredential(memberA, assertionId)).toBeNull();
    expect(await revealCredential(anonymous(), assertionId)).toBeNull();
  });
});

describe('badges : vérification publique et révocation', () => {
  it('badge valide : signature vérifiée, prénom et initiale seulement', async () => {
    const view = await resolvePublicBadge(token);
    expect(view).toMatchObject({ check: 'valid', holder: { firstName: expect.any(String), lastInitial: 'T.' }, badge: { name: 'Badge de test sécurité' } });
    expect(JSON.stringify(view)).not.toContain('@securite.happi.test');
  });

  it('identifiant inconnu ou mal formé : réponse neutre', async () => {
    expect(await resolvePublicBadge(randomBytes(32).toString('base64url'))).toBeNull();
    expect(await resolvePublicBadge('../../etc/passwd')).toBeNull();
    expect(badgeUrls.verify(token)).toContain('/badges/verifier/');
  });

  it('ni participant ni formateur ne révoquent ; l’administrateur révoque avec motif', async () => {
    for (const client of [participantA, trainerA, memberA]) {
      expect((await client.rpc('revoke_badge_assertion', { p_assertion_id: assertionId, p_reason: 'Tentative' })).error).not.toBeNull();
    }
    expect((await adminClient.rpc('revoke_badge_assertion', { p_assertion_id: assertionId, p_reason: '' })).error).not.toBeNull();
    expect((await adminClient.rpc('revoke_badge_assertion', { p_assertion_id: assertionId, p_reason: 'Erreur d’attribution' })).error).toBeNull();
    const view = await resolvePublicBadge(token);
    expect(view?.check).toBe('revoked');
    expect(view?.revokedAt).toBeTruthy();
    expect(await revealCredential(participantA, assertionId)).toBeNull();
  });

  it('émission et révocation sont journalisées, sans le jeton', async () => {
    const { data } = await service.from('audit_logs').select('action, metadata').eq('entity_id', assertionId);
    expect(data?.map((row) => row.action).sort()).toEqual(['badge_assertion.issued', 'badge_assertion.revoked']);
    expect(JSON.stringify(data)).not.toContain(token);
  });
});
