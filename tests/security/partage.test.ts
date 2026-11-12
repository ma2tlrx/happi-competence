/**
 * Partage du passeport par lien (passport_shares) : seul le participant crée et gère
 * ses liens, les jetons et empreintes ne sortent jamais, la consultation publique
 * n'est possible qu'avec la clé de service, et la vue publique ne contient rien
 * d'exclu (commentaires, coordonnées, organisme, données d'un autre participant).
 */
import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadPublicPassport } from '@/lib/passport-share/server';
import { deriveShareKeys, encryptShareToken, generateShareToken, hashShareToken } from '@/lib/passport-share/token';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let participantA: Client;
let participantB: Client;
let trainerA: Client;
let memberA: Client;
let adminClient: Client;
let adminId: string;
const keys = deriveShareKeys('secret-des-tests-de-securite');

function newToken() {
  const token = generateShareToken();
  return { token, hash: hashShareToken(token), cipher: encryptShareToken(token, keys.encryption) };
}

async function create(client: Client, options: { days?: number; label?: string; report?: boolean; hbs?: boolean } = {}) {
  const t = newToken();
  const result = await client.rpc('create_passport_share', {
    p_token_hash: t.hash,
    p_token_ciphertext: t.cipher,
    p_label: options.label ?? 'Entreprise test',
    p_duration_days: options.days ?? 30,
    p_include_sociocognitive: options.hbs ?? false,
    p_include_report: options.report ?? false,
  });
  return { ...t, id: result.data as string | null, error: result.error };
}

let shareA: Awaited<ReturnType<typeof create>>;

beforeAll(async () => {
  f = await createFixtures();
  participantA = await signIn(f.accounts.participantA.email);
  participantB = await signIn(f.accounts.participantB.email);
  trainerA = f.clients.trainerA;
  memberA = await signIn(f.accounts.memberA.email);
  const email = `admin.${f.tag}@securite.happi.test`;
  const password = `Adm-${randomBytes(12).toString('base64url')}9`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { account_type: 'pro', first_name: 'Admin', last_name: 'Test' } });
  adminId = created.data.user!.id;
  await service.from('profiles').update({ role: 'admin' }).eq('id', adminId);
  adminClient = anonymous();
  await adminClient.auth.signInWithPassword({ email, password });
  shareA = await create(participantA, { hbs: true });
});

afterAll(async () => {
  await destroyFixtures(f);
  if (adminId) await service.auth.admin.deleteUser(adminId);
});

describe('partage : création', () => {
  it('le participant crée un lien ; la base fixe l’expiration et conserve l’empreinte, jamais le jeton', async () => {
    expect(shareA.error).toBeNull();
    const { data: row } = await service.from('passport_shares').select('*').eq('id', shareA.id!).single();
    expect(row).toMatchObject({ participant_id: f.participantA, token_hash: shareA.hash, duration_days: 30, view_count: 0, revoked_at: null });
    expect(JSON.stringify(row)).not.toContain(shareA.token);
    const days = (new Date(row!.expires_at).getTime() - new Date(row!.created_at).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  it('ni formateur, ni organisme, ni anonyme ne crée de lien', async () => {
    expect((await create(trainerA)).error).not.toBeNull();
    expect((await create(memberA)).error).not.toBeNull();
    expect((await create(adminClient)).error).not.toBeNull();
    expect((await create(anonymous())).error).not.toBeNull();
  });

  it('aucune écriture directe dans la table, même par le titulaire', async () => {
    const t = newToken();
    const insert = await participantA.from('passport_shares').insert({ participant_id: f.participantA, token_hash: t.hash, token_ciphertext: t.cipher, label: 'x', duration_days: 7, expires_at: new Date(Date.now() + 864e5).toISOString() });
    expect(insert.error).not.toBeNull();
    await participantA.from('passport_shares').update({ view_count: 999, expires_at: '2099-01-01T00:00:00Z' }).eq('id', shareA.id!);
    const { data: row } = await service.from('passport_shares').select('view_count, expires_at').eq('id', shareA.id!).single();
    expect(row!.view_count).toBe(0);
    expect(row!.expires_at.startsWith('2099')).toBe(false);
  });

  it('durée hors 7/30/90 jours et bilan inexistant refusés', async () => {
    expect((await create(participantA, { days: 365 })).error).not.toBeNull();
    expect((await create(participantA, { report: true })).error?.message).toMatch(/bilan validé/);
  });

  it('au plus 10 liens actifs par participant', async () => {
    for (let i = 0; i < 9; i += 1) expect((await create(participantB, { days: 7, label: `Lien ${i}` })).error).toBeNull();
    expect((await create(participantB, { days: 7 })).error).toBeNull();
    const eleventh = await create(participantB, { days: 7 });
    expect(eleventh.error?.message).toMatch(/10 liens actifs/);
  });
});

describe('partage : cloisonnement', () => {
  it('le titulaire lit ses liens sans empreinte ni chiffré', async () => {
    expect((await participantA.from('passport_shares').select('token_hash').eq('id', shareA.id!)).error).not.toBeNull();
    expect((await participantA.from('passport_shares').select('token_ciphertext').eq('id', shareA.id!)).error).not.toBeNull();
    const { data } = await participantA.from('passport_shares').select('id, label, view_count').eq('id', shareA.id!);
    expect(data).toHaveLength(1);
  });

  it('un autre participant, le formateur et l’organisme ne voient pas les liens', async () => {
    for (const client of [participantB, trainerA, memberA]) {
      expect((await client.from('passport_shares').select('id').eq('id', shareA.id!)).data ?? []).toEqual([]);
    }
    expect((await anonymous().from('passport_shares').select('id')).data ?? []).toEqual([]);
  });

  it('seul le titulaire récupère le jeton chiffré de son lien', async () => {
    expect((await participantA.rpc('my_passport_share_secret', { p_share_id: shareA.id! })).data).toBe(shareA.cipher);
    for (const client of [participantB, trainerA, memberA, adminClient]) {
      expect((await client.rpc('my_passport_share_secret', { p_share_id: shareA.id! })).data ?? null).toBeNull();
    }
  });

  it('un participant ne révoque pas le lien d’un autre ; le formateur et l’organisme non plus', async () => {
    for (const client of [participantB, trainerA, memberA]) {
      expect((await client.rpc('revoke_passport_share', { p_share_id: shareA.id! })).error).not.toBeNull();
    }
    const { data } = await service.from('passport_shares').select('revoked_at').eq('id', shareA.id!).single();
    expect(data!.revoked_at).toBeNull();
  });

  it('la consultation n’est pas appelable avec la clé publique ni par un compte connecté', async () => {
    expect((await anonymous().rpc('consume_passport_share', { p_token_hash: shareA.hash })).error).not.toBeNull();
    expect((await participantA.rpc('consume_passport_share', { p_token_hash: shareA.hash })).error).not.toBeNull();
  });
});

describe('partage : consultation', () => {
  it('jeton valide : consultation comptée et journalisée avec une empreinte d’IP, sans l’IP', async () => {
    const ipHash = 'a'.repeat(64);
    const { data } = await service.rpc('consume_passport_share', { p_token_hash: shareA.hash, p_ip_hash: ipHash });
    expect(data).toMatchObject({ participant_id: f.participantA, include_sociocognitive: true, include_report: false });
    const { data: row } = await service.from('passport_shares').select('view_count, last_viewed_at').eq('id', shareA.id!).single();
    expect(row!.view_count).toBe(1);
    expect(row!.last_viewed_at).not.toBeNull();
    const { data: views } = await service.from('passport_share_views').select('ip_hash').eq('share_id', shareA.id!);
    expect(views).toEqual([{ ip_hash: ipHash }]);
    // Le titulaire voit la date des consultations, pas l'empreinte d'IP.
    expect((await participantA.from('passport_share_views').select('viewed_at').eq('share_id', shareA.id!)).data).toHaveLength(1);
    expect((await participantA.from('passport_share_views').select('ip_hash').eq('share_id', shareA.id!)).error).not.toBeNull();
    expect((await participantB.from('passport_share_views').select('id').eq('share_id', shareA.id!)).data ?? []).toEqual([]);
  });

  it('jeton faux ou mal formé : même réponse nulle, rien n’est compté', async () => {
    for (const hash of [hashShareToken(generateShareToken()), hashShareToken('pas-un-jeton'), 'x', '']) {
      expect((await service.rpc('consume_passport_share', { p_token_hash: hash })).data).toBeNull();
    }
    // Le jeton en clair à la place de l'empreinte ne fonctionne pas non plus.
    expect((await service.rpc('consume_passport_share', { p_token_hash: shareA.token })).data).toBeNull();
  });

  it('jeton expiré : réponse nulle, sans compteur', async () => {
    const expired = await create(participantA, { days: 7, label: 'Expiré' });
    await service.from('passport_shares').update({ created_at: new Date(Date.now() - 10 * 864e5).toISOString(), expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', expired.id!);
    expect((await service.rpc('consume_passport_share', { p_token_hash: expired.hash })).data).toBeNull();
    expect((await service.from('passport_shares').select('view_count').eq('id', expired.id!).single()).data!.view_count).toBe(0);
    expect((await participantA.rpc('my_passport_share_secret', { p_share_id: expired.id! })).data ?? null).toBeNull();
  });

  it('jeton révoqué par le titulaire : réponse nulle ; révocation par l’administrateur = modération', async () => {
    const own = await create(participantA, { days: 7, label: 'Révoqué' });
    expect((await participantA.rpc('revoke_passport_share', { p_share_id: own.id! })).error).toBeNull();
    expect((await service.rpc('consume_passport_share', { p_token_hash: own.hash })).data).toBeNull();
    expect((await service.from('passport_shares').select('revoked_reason').eq('id', own.id!).single()).data!.revoked_reason).toBe('participant');

    const moderated = await create(participantA, { days: 7, label: 'Modéré' });
    expect((await adminClient.from('passport_shares').select('id').eq('id', moderated.id!)).data).toHaveLength(1);
    expect((await adminClient.from('passport_shares').select('token_hash').eq('id', moderated.id!)).error).not.toBeNull();
    expect((await adminClient.rpc('revoke_passport_share', { p_share_id: moderated.id! })).error).toBeNull();
    expect((await service.from('passport_shares').select('revoked_reason').eq('id', moderated.id!).single()).data!.revoked_reason).toBe('moderation');
    expect((await service.rpc('consume_passport_share', { p_token_hash: moderated.hash })).data).toBeNull();
  });

  it('création et révocation sont journalisées sans jeton ni empreinte', async () => {
    const { data } = await service.from('audit_logs').select('action, metadata, entity_id').eq('participant_id', f.participantA).like('action', 'passport_share.%');
    expect(data!.map((row) => row.action)).toEqual(expect.arrayContaining(['passport_share.created', 'passport_share.revoked']));
    expect(JSON.stringify(data)).not.toContain(shareA.hash);
    expect(JSON.stringify(data)).not.toContain(shareA.token);
  });
});

describe('partage : contenu de la vue publique', () => {
  it('reflète les niveaux validés du seul participant concerné, sans contenu exclu', async () => {
    const view = await loadPublicPassport(service, f.participantA, { includeSociocognitive: true, includeReport: true }, new Date(Date.now() + 864e5).toISOString());
    expect(view).not.toBeNull();
    const json = JSON.stringify(view);
    expect(view!.observationSessions).toBe(1);
    expect(view!.frameworks.flatMap((framework) => framework.skills)).toHaveLength(1);
    expect(view!.holder.lastInitial).toBe('T.');
    for (const forbidden of ['Note privée', 'Observation partagée', f.accounts.participantA.email, f.accounts.participantB.email, `Sécurité A ${f.tag}`, `Groupe sécurité A ${f.tag}`, f.participantB, f.participantA, 'formateura']) {
      expect(json, forbidden).not.toContain(forbidden);
    }
    expect(view!.report).toBeNull();
  });

  it('un brouillon d’évaluation n’apparaît pas', async () => {
    await trainerA.rpc('save_evaluation_draft', { p_session_id: f.sessionA, p_participant_id: f.participantA, p_scores: [{ skill_id: f.skillId, score: 4 }], p_comments: {} });
    const view = await loadPublicPassport(service, f.participantA, { includeSociocognitive: true, includeReport: false }, new Date().toISOString());
    expect(view!.frameworks.flatMap((framework) => framework.skills).map((skill) => skill.value)).toEqual([2]);
  });
});
