/**
 * Aide à l'observation et version facile à lire (migration 20261116120000) :
 * - un formateur ne structure des notes que pour les participants de ses groupes ;
 * - la version facile à lire suit les droits des bilans : brouillons réservés à
 *   l'équipe, versions validées lisibles par le participant et son organisme,
 *   version validée figée, préparée seulement à partir d'un bilan validé.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let trainerA: Client;
let trainerB: Client;
let memberA: Client;
let memberB: Client;
let participantA: Client;
let reportId: string;
let easyReadId: string;

const data = { engineVersion: 'bilan-test', counts: { observations: 1 } };
const content = { introduction: 'Introduction.', profile: { summary: 'Synthèse.', traits: [] }, frameworks: [], behaviour: { summary: '', themes: [] }, skills: [], recommendations: [], conclusion: 'Conclusion.', closing: 'Bravo.', limits: '', dataWarnings: [] };
const easy = { sections: [{ title: 'Ce qu’est ce bilan', sentences: ['Ce bilan parle de vous.'] }] };

beforeAll(async () => {
  f = await createFixtures();
  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  memberA = await signIn(f.accounts.memberA.email);
  memberB = await signIn(f.accounts.memberB.email);
  participantA = await signIn(f.accounts.participantA.email);
  const { data: row } = await trainerA.from('participant_reports').insert({ participant_id: f.participantA, version: 0, data, engine_version: 'bilan-test', content }).select('id').single();
  reportId = row!.id;
});

afterAll(async () => {
  await destroyFixtures(f);
});

describe('assistant d’observation : autorisation', () => {
  it('le formateur du groupe peut structurer pour son participant, et l’usage est journalisé sans texte', async () => {
    expect((await trainerA.rpc('authorize_observation_assist', { p_session_id: f.sessionA, p_participant_id: f.participantA })).error).toBeNull();
    const { data: logs } = await service.from('audit_logs').select('metadata, participant_id').eq('action', 'ai.observation_structured').eq('actor_id', f.accounts.trainerA.id);
    expect(logs?.[0]).toMatchObject({ metadata: {}, participant_id: f.participantA });
  });

  it('refuse un participant d’un autre groupe, une séance d’un autre groupe, et les rôles non formateurs', async () => {
    expect((await trainerA.rpc('authorize_observation_assist', { p_session_id: f.sessionA, p_participant_id: f.participantB })).error?.code).toBe('42501');
    expect((await trainerB.rpc('authorize_observation_assist', { p_session_id: f.sessionA, p_participant_id: f.participantA })).error?.code).toBe('42501');
    expect((await participantA.rpc('authorize_observation_assist', { p_session_id: f.sessionA, p_participant_id: f.participantA })).error?.code).toBe('42501');
    expect((await memberA.rpc('authorize_observation_assist', { p_session_id: f.sessionA, p_participant_id: f.participantA })).error?.code).toBe('42501');
  });
});

describe('version facile à lire : droits', () => {
  it('ne se prépare pas sur un bilan en brouillon', async () => {
    const { error } = await trainerA.from('participant_report_easy_reads').insert({ report_id: reportId, participant_id: f.participantA, content: easy, content_source: 'ai' });
    expect(error?.message).toMatch(/bilan validé/);
  });

  it('le formateur prépare un brouillon ; la base fixe version, participant et statut', async () => {
    expect((await trainerA.from('participant_reports').update({ status: 'final' }).eq('id', reportId)).error).toBeNull();
    const { data: row, error } = await trainerA
      .from('participant_report_easy_reads')
      .insert({ report_id: reportId, participant_id: f.participantB, version: 9, status: 'validated', content: easy, content_source: 'ai' })
      .select('id, version, status, participant_id')
      .single();
    expect(error).toBeNull();
    expect(row).toMatchObject({ version: 1, status: 'draft', participant_id: f.participantA });
    easyReadId = row!.id;
  });

  it('un autre formateur ne peut ni préparer ni lire', async () => {
    expect((await trainerB.from('participant_report_easy_reads').insert({ report_id: reportId, participant_id: f.participantA, content: easy, content_source: 'ai' })).error).not.toBeNull();
    expect((await trainerB.from('participant_report_easy_reads').select('id').eq('id', easyReadId)).data).toEqual([]);
  });

  it('le participant et son organisme ne voient pas le brouillon', async () => {
    expect((await participantA.from('participant_report_easy_reads').select('id').eq('id', easyReadId)).data).toEqual([]);
    expect((await memberA.from('participant_report_easy_reads').select('id').eq('id', easyReadId)).data).toEqual([]);
    expect((await participantA.from('participant_report_easy_reads').insert({ report_id: reportId, participant_id: f.participantA, content: easy, content_source: 'manual' })).error).not.toBeNull();
  });

  it('une fois validée, la version est visible du participant et de son organisme seulement, et figée', async () => {
    expect((await trainerA.from('participant_report_easy_reads').update({ status: 'validated' }).eq('id', easyReadId)).error).toBeNull();
    expect((await participantA.from('participant_report_easy_reads').select('id').eq('id', easyReadId)).data).toHaveLength(1);
    expect((await memberA.from('participant_report_easy_reads').select('id').eq('id', easyReadId)).data).toHaveLength(1);
    expect((await memberB.from('participant_report_easy_reads').select('id').eq('id', easyReadId)).data).toEqual([]);
    await trainerA.from('participant_report_easy_reads').update({ content: { sections: [] } }).eq('id', easyReadId);
    await trainerA.from('participant_report_easy_reads').delete().eq('id', easyReadId);
    const { data: row } = await service.from('participant_report_easy_reads').select('content, validated_by').eq('id', easyReadId).single();
    expect(row).toMatchObject({ content: easy, validated_by: f.accounts.trainerA.id });
  });

  it('chaque étape est journalisée', async () => {
    const { data: logs } = await service.from('audit_logs').select('action').eq('entity_id', reportId);
    expect((logs ?? []).map((log) => log.action)).toEqual(expect.arrayContaining(['report.easy_read_created', 'report.easy_read_validated']));
  });
});
