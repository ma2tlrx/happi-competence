/**
 * Fiche d'entrée FSE+ (participant_entry_profiles) — données sensibles (art. 9 RGPD) :
 *   • un formateur ne lit ni n'écrit jamais ces données, même pour les participants de ses groupes ;
 *   • un organisme est limité à ses participants (permission org.entry_profile.manage) ;
 *   • un participant est limité à lui-même : il complète et corrige ses réponses, sans changer la date d'entrée ;
 *   • chaque écriture est journalisée sans les valeurs ; seule l'administration supprime.
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
let profileId: string;

const entryDate = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);

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

describe('fiche d’entrée FSE+', () => {
  it('l’organisme du participant saisit la fiche ; la CITE est dérivée du niveau français', async () => {
    const { data, error } = await memberA
      .from('participant_entry_profiles')
      .insert({
        participant_id: f.participantA,
        group_id: f.groupA,
        entry_date: entryDate,
        labour_status: 'chomeur',
        unemployment_duration: '12_23_mois',
        diploma_level: 'niveau_3',
        age_band: '18_29',
        gender: 'femme',
        disability: 'oui',
        rqth: 'ne_souhaite_pas_repondre',
      })
      .select('id, education_isced, recorded_by, participant_confirmed_at')
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ education_isced: 'cite_3_4', recorded_by: f.accounts.memberA.id, participant_confirmed_at: null });
    profileId = data!.id;
  });

  it('le formateur du groupe ne lit, ne crée ni ne modifie jamais la fiche', async () => {
    expect((await trainerA.from('participant_entry_profiles').select('id').eq('participant_id', f.participantA)).data).toEqual([]);
    expect((await trainerA.from('participant_entry_profiles').select('id')).data).toEqual([]);
    const update = await trainerA.from('participant_entry_profiles').update({ disability: 'non' }).eq('id', profileId).select('id');
    expect(update.data ?? []).toEqual([]);
    const insert = await trainerA.from('participant_entry_profiles').insert({ participant_id: f.participantA, group_id: null, labour_status: 'inactif' });
    expect(insert.error).not.toBeNull();
    expect((await trainerB.from('participant_entry_profiles').select('id')).data).toEqual([]);
    // La valeur n'a pas bougé.
    expect((await service.from('participant_entry_profiles').select('disability').eq('id', profileId).single()).data?.disability).toBe('oui');
  });

  it('un autre organisme ne voit ni ne saisit rien pour ce participant', async () => {
    expect((await memberB.from('participant_entry_profiles').select('id').eq('participant_id', f.participantA)).data).toEqual([]);
    const insert = await memberB.from('participant_entry_profiles').insert({ participant_id: f.participantA, group_id: null, labour_status: 'inactif' });
    expect(insert.error).not.toBeNull();
    const update = await memberB.from('participant_entry_profiles').update({ minority: 'oui' }).eq('id', profileId).select('id');
    expect(update.data ?? []).toEqual([]);
  });

  it('un organisme sans la permission dédiée ne lit plus la fiche', async () => {
    await service.from('role_permissions').delete().eq('role_code', 'organisme').eq('permission_code', 'org.entry_profile.manage');
    try {
      expect((await memberA.from('participant_entry_profiles').select('id').eq('id', profileId)).data).toEqual([]);
    } finally {
      await service.from('role_permissions').insert({ role_code: 'organisme', permission_code: 'org.entry_profile.manage' });
    }
    expect((await memberA.from('participant_entry_profiles').select('id').eq('id', profileId)).data).toHaveLength(1);
  });

  it('le participant lit et corrige ses réponses, sans changer la date d’entrée ; il ne supprime pas', async () => {
    expect((await participantA.from('participant_entry_profiles').select('id').eq('participant_id', f.participantA)).data).toHaveLength(1);
    const { data, error } = await participantA
      .from('participant_entry_profiles')
      .update({ disability: 'ne_souhaite_pas_repondre', entry_date: '2020-01-01' })
      .eq('id', profileId)
      .select('disability, entry_date, participant_confirmed_at, participant_informed_at')
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ disability: 'ne_souhaite_pas_repondre', entry_date: entryDate });
    expect(data!.participant_confirmed_at).not.toBeNull();
    expect(data!.participant_informed_at).not.toBeNull();
    await participantA.from('participant_entry_profiles').delete().eq('id', profileId);
    expect((await service.from('participant_entry_profiles').select('id').eq('id', profileId)).data).toHaveLength(1);
  });

  it('un participant ne lit ni ne crée la fiche d’un autre', async () => {
    expect((await participantB.from('participant_entry_profiles').select('id').eq('participant_id', f.participantA)).data).toEqual([]);
    const insert = await participantB.from('participant_entry_profiles').insert({ participant_id: f.participantA, group_id: null, labour_status: 'inactif' });
    expect(insert.error).not.toBeNull();
    // Pour lui-même, hors de ses groupes : refusé (groupe A).
    const foreignGroup = await participantB.from('participant_entry_profiles').insert({ participant_id: f.participantB, group_id: f.groupA });
    expect(foreignGroup.error).not.toBeNull();
    const own = await participantB.from('participant_entry_profiles').insert({ participant_id: f.participantB, group_id: f.groupB, gender: 'homme' }).select('id').single();
    expect(own.error).toBeNull();
  });

  it('journal : champs modifiés listés, jamais les valeurs', async () => {
    const { data } = await service.from('audit_logs').select('action, metadata').eq('participant_id', f.participantA).like('action', 'entry_profile.%');
    expect(data?.some((row) => row.action === 'entry_profile.recorded')).toBe(true);
    const updated = data?.find((row) => row.action === 'entry_profile.updated');
    expect((updated?.metadata as { fields?: string[] }).fields).toEqual(['disability']);
    expect(JSON.stringify(data)).not.toContain('ne_souhaite_pas_repondre');
  });

  it('journal des consultations : refusé au formateur et à un autre organisme', async () => {
    expect((await memberA.rpc('log_entry_profile_event', { p_action: 'entry_profile.viewed', p_participant_id: f.participantA })).error).toBeNull();
    expect((await trainerA.rpc('log_entry_profile_event', { p_action: 'entry_profile.viewed', p_participant_id: f.participantA })).error).not.toBeNull();
    expect((await trainerA.rpc('log_entry_profile_event', { p_action: 'export.fse_participants_csv' })).error).not.toBeNull();
    expect((await memberB.rpc('log_entry_profile_event', { p_action: 'entry_profile.viewed', p_participant_id: f.participantA })).error).not.toBeNull();
    expect((await participantA.rpc('log_entry_profile_event', { p_action: 'export.fse_participants_csv' })).error).not.toBeNull();
  });

  it('suppression du participant : la fiche part en cascade', async () => {
    const { data } = await service.from('participant_entry_profiles').select('id').eq('participant_id', f.participantB);
    expect(data).toHaveLength(1);
    // destroyFixtures supprime les participants ; on vérifie ici la cascade sur le groupe B.
    await service.from('group_members').delete().eq('group_id', f.groupB).eq('participant_id', f.participantB);
    await service.from('groups').delete().eq('id', f.groupB);
    expect((await service.from('participant_entry_profiles').select('id').eq('participant_id', f.participantB)).data).toEqual([]);
  });
});

describe('situations de sortie : compléments FSE+', () => {
  it('« autre formation » et « qualification obtenue » sont acceptées ; l’audit garde la qualification', async () => {
    const { error } = await trainerA
      .from('participant_outcomes')
      .insert({ participant_id: f.participantA, group_id: f.groupA, kind: 'exit', situation: 'formation_autre', qualification_obtained: true });
    expect(error).toBeNull();
    const { data } = await service.from('audit_logs').select('metadata').eq('participant_id', f.participantA).eq('action', 'outcome.recorded');
    expect(data?.some((row) => (row.metadata as { qualification_obtained?: boolean }).qualification_obtained === true)).toBe(true);
  });
});
