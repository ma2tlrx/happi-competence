/**
 * Points en direct (session_live_marks) : aide-mémoire du formateur. Lecture, écriture et suppression réservées
 * aux formateurs de CETTE session et à l'administration ; jamais le participant, l'organisme, un autre formateur
 * ni un anonyme. Le participant doit appartenir au groupe de la session. Aucun score n'est créé.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let participantA: Client;
let trainerA: Client;
let trainerB: Client;
let organisme: Client;
let admin: Client;
let markId: string;

const base = () => ({ block_index: 2, block_title: 'Le jeu de la montgolfière', elapsed_seconds: 840 });

beforeAll(async () => {
  f = await createFixtures();
  participantA = await signIn(f.accounts.participantA.email);
  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  organisme = await signIn(f.accounts.memberA.email);
  await service.from('profiles').update({ role: 'admin' }).eq('id', f.accounts.memberB.id);
  admin = await signIn(f.accounts.memberB.email);
});

afterAll(async () => {
  await destroyFixtures(f);
  const { count } = await service.from('session_live_marks').select('id', { count: 'exact', head: true }).in('session_id', [f.sessionA, f.sessionB]);
  expect(count).toBe(0);
});

describe('points en direct', () => {
  it('le formateur de la session ajoute un « + » général puis rattaché à une compétence', async () => {
    const general = await trainerA
      .from('session_live_marks')
      .insert({ session_id: f.sessionA, participant_id: f.participantA, created_by: f.accounts.trainerA.id, ...base() })
      .select('id, kind, skill_code, created_at')
      .single();
    expect(general.error).toBeNull();
    expect(general.data?.kind).toBe('plus');
    expect(general.data?.skill_code).toBeNull();
    expect(general.data?.created_at).toBeTruthy();
    markId = general.data!.id;
    const skilled = await trainerA
      .from('session_live_marks')
      .insert({ session_id: f.sessionA, participant_id: f.participantA, created_by: f.accounts.trainerA.id, skill_code: 'esprit_equipe', ...base() });
    expect(skilled.error).toBeNull();
    const read = await trainerA.from('session_live_marks').select('id, block_title, elapsed_seconds').eq('session_id', f.sessionA);
    expect(read.data).toHaveLength(2);
  });

  it('refuse un « + » signé au nom d’un autre utilisateur', async () => {
    const forged = await trainerA.from('session_live_marks').insert({ session_id: f.sessionA, participant_id: f.participantA, created_by: f.accounts.trainerB.id });
    expect(forged.error).not.toBeNull();
  });

  it('un participant hors du groupe de la session est refusé, même par le formateur de la session', async () => {
    const outside = await trainerA.from('session_live_marks').insert({ session_id: f.sessionA, participant_id: f.participantB, created_by: f.accounts.trainerA.id });
    expect(outside.error).not.toBeNull();
  });

  it('un autre formateur ne lit, n’écrit ni ne supprime rien sur cette session', async () => {
    expect((await trainerB.from('session_live_marks').select('id').eq('session_id', f.sessionA)).data).toEqual([]);
    const write = await trainerB.from('session_live_marks').insert({ session_id: f.sessionA, participant_id: f.participantA, created_by: f.accounts.trainerB.id });
    expect(write.error).not.toBeNull();
    const del = await trainerB.from('session_live_marks').delete().eq('id', markId).select('id');
    expect(del.data ?? []).toEqual([]);
  });

  it('le participant concerné ne voit aucun « + » ni ne peut en créer', async () => {
    expect((await participantA.from('session_live_marks').select('id')).data ?? []).toEqual([]);
    const write = await participantA.from('session_live_marks').insert({ session_id: f.sessionA, participant_id: f.participantA, created_by: f.accounts.participantA.id });
    expect(write.error).not.toBeNull();
    const del = await participantA.from('session_live_marks').delete().eq('id', markId).select('id');
    expect(del.data ?? []).toEqual([]);
  });

  it('l’organisme de rattachement et les anonymes n’y ont pas accès', async () => {
    expect((await organisme.from('session_live_marks').select('id')).data ?? []).toEqual([]);
    const write = await organisme.from('session_live_marks').insert({ session_id: f.sessionA, participant_id: f.participantA, created_by: f.accounts.memberA.id });
    expect(write.error).not.toBeNull();
    const anon = await anonymous().from('session_live_marks').select('id');
    expect(anon.data ?? []).toEqual([]);
  });

  it('l’administration lit', async () => {
    const read = await admin.from('session_live_marks').select('id').eq('session_id', f.sessionA);
    expect(read.data).toHaveLength(2);
  });

  it('les marques ne sont pas modifiables (aucune politique ni droit de mise à jour)', async () => {
    const update = await trainerA.from('session_live_marks').update({ skill_code: 'autre' }).eq('id', markId).select('id');
    expect(update.data ?? []).toEqual([]);
  });

  it('la base refuse un code de compétence mal formé, un bloc ou un temps hors bornes', async () => {
    const row = { session_id: f.sessionA, participant_id: f.participantA, created_by: f.accounts.trainerA.id };
    expect((await trainerA.from('session_live_marks').insert({ ...row, skill_code: 'Esprit d\'équipe; drop' })).error).not.toBeNull();
    expect((await trainerA.from('session_live_marks').insert({ ...row, block_title: 'x'.repeat(201) })).error).not.toBeNull();
    expect((await trainerA.from('session_live_marks').insert({ ...row, elapsed_seconds: -1 })).error).not.toBeNull();
    expect((await trainerA.from('session_live_marks').insert({ ...row, kind: 'moins' })).error).not.toBeNull();
  });

  it('aucun score ni évaluation n’est créé par les points en direct', async () => {
    const { count } = await service.from('evaluation_scores').select('skill_id', { count: 'exact', head: true }).eq('skill_id', '00000000-0000-0000-0000-000000000000');
    expect(count).toBe(0);
    const evaluations = await service.from('evaluations').select('id').eq('session_id', f.sessionA);
    // La seule évaluation de la session est celle des fixtures (créée avant les points).
    expect(evaluations.data).toHaveLength(1);
  });

  it('le formateur de la session supprime ; l’annulation est effective', async () => {
    const del = await trainerA.from('session_live_marks').delete().eq('id', markId).select('id');
    expect(del.data).toEqual([{ id: markId }]);
    const read = await trainerA.from('session_live_marks').select('id').eq('session_id', f.sessionA);
    expect(read.data).toHaveLength(1);
  });

  it('la suppression de la session emporte ses points (cascade)', async () => {
    const del = await service.from('session_live_marks').select('id', { count: 'exact', head: true }).eq('session_id', f.sessionA);
    expect(del.count).toBe(1);
  });
});
