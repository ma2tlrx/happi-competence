/**
 * Droits sur les abandons et les situations des participants (participant_outcomes) :
 * un formateur ne saisit que pour ses groupes, un organisme ne voit (et ne saisit) que ses
 * participants, un participant ne lit que ses propres lignes. Un abandon reste visible dans l'historique.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let trainerA: Client;
let trainerB: Client;
let memberA: Client;
let memberB: Client;
let participantA: Client;
let participantB: Client;

beforeAll(async () => {
  f = await createFixtures();
  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  memberA = await signIn(f.accounts.memberA.email);
  memberB = await signIn(f.accounts.memberB.email);
  participantA = await signIn(f.accounts.participantA.email);
  participantB = await signIn(f.accounts.participantB.email);
});

afterAll(async () => {
  await destroyFixtures(f);
});

const today = new Date().toISOString().slice(0, 10);

describe('abandons', () => {
  it('un formateur d’un autre groupe ne peut pas déclarer l’abandon', async () => {
    const { data } = await trainerB
      .from('group_members')
      .update({ status: 'dropped', drop_reason: 'sante', dropped_at: today })
      .eq('group_id', f.groupA)
      .eq('participant_id', f.participantA)
      .select('id');
    expect(data ?? []).toEqual([]);
  });

  it('« autre motif » exige une précision ; la date ne peut pas être future', async () => {
    const other = await trainerA.from('group_members').update({ status: 'dropped', drop_reason: 'autre', dropped_at: today }).eq('group_id', f.groupA).eq('participant_id', f.participantA);
    expect(other.error).not.toBeNull();
    const future = await trainerA
      .from('group_members')
      .update({ status: 'dropped', drop_reason: 'sante', dropped_at: '2999-01-01' })
      .eq('group_id', f.groupA)
      .eq('participant_id', f.participantA);
    expect(future.error).not.toBeNull();
  });

  it('le formateur du groupe déclare l’abandon ; le participant n’est plus actif mais l’historique reste visible', async () => {
    const { data, error } = await trainerA
      .from('group_members')
      .update({ status: 'dropped', drop_reason: 'emploi_trouve', dropped_at: today })
      .eq('group_id', f.groupA)
      .eq('participant_id', f.participantA)
      .select('status, drop_reason, dropped_at, left_at')
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: 'dropped', drop_reason: 'emploi_trouve', dropped_at: today });
    expect(data!.left_at).not.toBeNull();
    // L'organisme et le participant voient toujours le groupe et sa séance.
    expect((await memberA.from('sessions').select('id').eq('id', f.sessionA)).data).toHaveLength(1);
    expect((await participantA.from('sessions').select('id').eq('id', f.sessionA)).data).toHaveLength(1);
    const { data: audit } = await service.from('audit_logs').select('action').eq('participant_id', f.participantA).eq('action', 'group.member_dropped');
    expect(audit?.length).toBeGreaterThan(0);
  });
});

describe('situations des participants', () => {
  let outcomeId: string;

  it('le formateur du groupe saisit la situation de sortie', async () => {
    const { data, error } = await trainerA
      .from('participant_outcomes')
      .insert({ participant_id: f.participantA, group_id: f.groupA, kind: 'exit', situation: 'emploi_durable', details: 'CDI', recorded_by: f.accounts.memberB.id })
      .select('id, recorded_by')
      .single();
    expect(error).toBeNull();
    expect(data!.recorded_by).toBe(f.accounts.trainerA.id);
    outcomeId = data!.id;
  });

  it('une seule ligne par participant, groupe et moment', async () => {
    const { error } = await trainerA.from('participant_outcomes').insert({ participant_id: f.participantA, group_id: f.groupA, kind: 'exit', situation: 'autre_etape' });
    expect(error).not.toBeNull();
  });

  it('un formateur d’un autre groupe ne lit, ne saisit ni ne modifie rien', async () => {
    expect((await trainerB.from('participant_outcomes').select('id').eq('participant_id', f.participantA)).data).toEqual([]);
    expect((await trainerB.from('participant_outcomes').insert({ participant_id: f.participantA, group_id: f.groupA, kind: 'entry', situation: 'autre_etape' })).error).not.toBeNull();
    // Pas de rattachement au groupe B : refus, même par un formateur de ce groupe.
    expect((await trainerB.from('participant_outcomes').insert({ participant_id: f.participantA, group_id: f.groupB, kind: 'entry', situation: 'autre_etape' })).error).not.toBeNull();
    const { data } = await trainerB.from('participant_outcomes').update({ situation: 'sans_nouvelles' }).eq('id', outcomeId).select('id');
    expect(data ?? []).toEqual([]);
  });

  it('l’organisme du participant lit et complète ; un autre organisme ne voit rien', async () => {
    expect((await memberA.from('participant_outcomes').select('id').eq('id', outcomeId)).data).toHaveLength(1);
    const { error } = await memberA.from('participant_outcomes').insert({ participant_id: f.participantA, group_id: f.groupA, kind: 'followup_3m', situation: 'emploi_transition', observed_on: today });
    expect(error).toBeNull();
    expect((await memberB.from('participant_outcomes').select('id').eq('participant_id', f.participantA)).data).toEqual([]);
    expect((await memberB.from('participant_outcomes').insert({ participant_id: f.participantA, group_id: f.groupA, kind: 'followup_6m', situation: 'autre_etape' })).error).not.toBeNull();
  });

  it('le participant lit ses propres lignes, sans pouvoir écrire ; les autres participants ne voient rien', async () => {
    expect((await participantA.from('participant_outcomes').select('id').eq('participant_id', f.participantA)).data?.length).toBe(2);
    expect((await participantA.from('participant_outcomes').insert({ participant_id: f.participantA, group_id: f.groupA, kind: 'entry', situation: 'autre_etape' })).error).not.toBeNull();
    expect((await participantB.from('participant_outcomes').select('id').eq('participant_id', f.participantA)).data).toEqual([]);
  });

  it('une modification est historisée ; seule l’administration peut supprimer', async () => {
    expect((await trainerA.from('participant_outcomes').update({ situation: 'formation_qualifiante' }).eq('id', outcomeId)).error).toBeNull();
    const { data: audit } = await service.from('audit_logs').select('action, metadata').eq('participant_id', f.participantA).eq('action', 'outcome.updated');
    expect(audit?.some((row) => (row.metadata as { previous_situation?: string }).previous_situation === 'emploi_durable')).toBe(true);
    await trainerA.from('participant_outcomes').delete().eq('id', outcomeId);
    expect((await service.from('participant_outcomes').select('id').eq('id', outcomeId)).data).toHaveLength(1);
  });

  it('une date d’observation future est refusée', async () => {
    const { error } = await trainerA.from('participant_outcomes').update({ observed_on: '2999-01-01' }).eq('id', outcomeId);
    expect(error).not.toBeNull();
  });
});
