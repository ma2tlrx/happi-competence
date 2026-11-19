/**
 * Droits des financements : financeurs, conventions et rattachements réservés à
 * l'administrateur ; l'organisme lit seulement, par org_funding_conventions(), les conventions
 * (hors brouillons) dont un groupe concerne ses participants, sans montant ni notes ni contact ;
 * le formateur et le participant n'ont aucun accès. Exports journalisés par l'administrateur seul.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let memberA: Client;
let memberB: Client;
let trainerA: Client;
let participantA: Client;
let admin: Client;
let adminId: string;
let funderId: string;
let conventionId: string;

beforeAll(async () => {
  f = await createFixtures();
  memberA = await signIn(f.accounts.memberA.email);
  memberB = await signIn(f.accounts.memberB.email);
  participantA = await signIn(f.accounts.participantA.email);
  trainerA = f.clients.trainerA;
  // Un administrateur temporaire : le formateur B promu le temps du test.
  adminId = f.accounts.trainerB.id;
  await service.from('profiles').update({ role: 'admin' }).eq('id', adminId);
  admin = await signIn(f.accounts.trainerB.email);
});

afterAll(async () => {
  if (conventionId) await service.from('funding_conventions').delete().eq('id', conventionId);
  if (funderId) await service.from('funders').delete().eq('id', funderId);
  await service.from('profiles').update({ role: 'formateur' }).eq('id', adminId);
  await destroyFixtures(f);
});

describe('administration des financements', () => {
  it('l’administrateur crée un financeur, une convention et rattache un groupe', async () => {
    const funder = await admin.from('funders').insert({ name: `Région test ${f.tag}`, kind: 'region', contact_email: 'contact@region.test', is_demo: true }).select('id, is_demo').single();
    expect(funder.error).toBeNull();
    // Un compte connecté ne peut pas marquer une donnée « démo ».
    expect(funder.data?.is_demo).toBe(false);
    funderId = funder.data!.id;
    const convention = await admin
      .from('funding_conventions')
      .insert({
        funder_id: funderId,
        reference: `REG-${f.tag}`,
        title: 'Action test',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        planned_participants: 10,
        planned_hours_per_participant: 18,
        amount_eur: 4200,
        notes: 'Note interne',
        status: 'en_cours',
      })
      .select('id')
      .single();
    expect(convention.error).toBeNull();
    conventionId = convention.data!.id;
    expect((await admin.from('funding_convention_groups').insert({ convention_id: conventionId, group_id: f.groupA })).error).toBeNull();
  });

  it('un groupe ne relève que d’une convention', async () => {
    const other = await admin
      .from('funding_conventions')
      .insert({ funder_id: funderId, title: 'Seconde', start_date: '2026-01-01', end_date: '2026-06-30', planned_participants: 5, planned_hours_per_participant: 18 })
      .select('id')
      .single();
    expect(other.error).toBeNull();
    const duplicate = await admin.from('funding_convention_groups').insert({ convention_id: other.data!.id, group_id: f.groupA });
    expect(duplicate.error?.code).toBe('23505');
    await admin.from('funding_conventions').delete().eq('id', other.data!.id);
  });

  it('les écritures sont tracées dans le journal', async () => {
    const { data } = await service.from('audit_logs').select('action').eq('entity_id', conventionId);
    const actions = (data ?? []).map((row) => row.action);
    expect(actions).toContain('funding.convention_created');
    expect(actions).toContain('funding.group_attached');
  });

  it('seul l’administrateur journalise un export', async () => {
    expect((await admin.rpc('log_funding_export', { p_document: 'bilan_action_pdf', p_convention_id: conventionId })).error).toBeNull();
    expect((await admin.rpc('log_funding_export', { p_document: 'bpf_csv', p_year: 2026 })).error).toBeNull();
    expect((await admin.rpc('log_funding_export', { p_document: 'autre', p_convention_id: conventionId })).error).not.toBeNull();
    for (const client of [memberA, trainerA, participantA]) {
      expect((await client.rpc('log_funding_export', { p_document: 'bpf_csv', p_year: 2026 })).error).not.toBeNull();
    }
  });
});

describe('organisme : lecture seule, colonnes non financières', () => {
  it('aucune lecture directe des tables (montant, notes, contact protégés)', async () => {
    expect((await memberA.from('funding_conventions').select('id')).data ?? []).toHaveLength(0);
    expect((await memberA.from('funders').select('id')).data ?? []).toHaveLength(0);
    expect((await memberA.from('funding_convention_groups').select('group_id')).data ?? []).toHaveLength(0);
  });

  it('voit la convention dont un groupe accueille ses participants, limitée à ses groupes', async () => {
    const { data, error } = await memberA.rpc('org_funding_conventions');
    expect(error).toBeNull();
    const row = (data ?? []).find((item) => item.id === conventionId);
    expect(row).toMatchObject({ reference: `REG-${f.tag}`, funder_kind: 'region', group_ids: [f.groupA] });
    expect(row).not.toHaveProperty('amount_eur');
    expect(row).not.toHaveProperty('notes');
  });

  it('un autre organisme ne la voit pas', async () => {
    const { data } = await memberB.rpc('org_funding_conventions');
    expect((data ?? []).some((item) => item.id === conventionId)).toBe(false);
  });

  it('une convention en brouillon reste invisible', async () => {
    await admin.from('funding_conventions').update({ status: 'brouillon' }).eq('id', conventionId);
    const { data } = await memberA.rpc('org_funding_conventions');
    expect((data ?? []).some((item) => item.id === conventionId)).toBe(false);
    await admin.from('funding_conventions').update({ status: 'en_cours' }).eq('id', conventionId);
  });

  it('ne peut ni créer, ni modifier, ni supprimer', async () => {
    expect((await memberA.from('funders').insert({ name: 'Pirate', kind: 'autre_prive' })).error).not.toBeNull();
    const { data: updated } = await memberA.from('funding_conventions').update({ title: 'Pirate' }).eq('id', conventionId).select('id');
    expect(updated ?? []).toHaveLength(0);
    await memberA.from('funding_convention_groups').delete().eq('group_id', f.groupA);
    const { data: link } = await service.from('funding_convention_groups').select('group_id').eq('group_id', f.groupA);
    expect(link).toHaveLength(1);
    const { data: title } = await service.from('funding_conventions').select('title').eq('id', conventionId).single();
    expect(title?.title).toBe('Action test');
  });
});

describe('formateur, participant, visiteur : aucun accès', () => {
  it('ni lecture ni écriture', async () => {
    for (const client of [trainerA, participantA]) {
      expect((await client.from('funding_conventions').select('id')).data ?? []).toHaveLength(0);
      expect((await client.from('funders').select('id')).data ?? []).toHaveLength(0);
      expect((await client.rpc('org_funding_conventions')).data ?? []).toHaveLength(0);
      expect((await client.from('funders').insert({ name: 'Interdit', kind: 'etat' })).error).not.toBeNull();
    }
    expect((await anonymous().rpc('org_funding_conventions')).error).not.toBeNull();
    expect((await anonymous().from('funding_conventions').select('id')).error).not.toBeNull();
  });
});
