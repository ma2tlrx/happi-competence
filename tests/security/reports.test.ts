/**
 * Droits sur les bilans (participant_reports), éprouvés avec de vraies sessions :
 * brouillons réservés à l'équipe du participant, bilans validés lisibles par le
 * participant et son organisme, résultats immuables, bilan validé figé.
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
let reportId: string;

const data = { engineVersion: 'bilan-test', counts: { observations: 1 } };
const content = { introduction: 'Introduction.', profile: { summary: 'Synthèse.', traits: [] }, frameworks: [], behaviour: { summary: '', themes: [] }, skills: [], recommendations: [], conclusion: 'Conclusion.', closing: 'Bravo.', limits: '', dataWarnings: [] };

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

describe('bilans : création et brouillons', () => {
  it('le formateur du participant crée un bilan ; la base fixe la version et l’auteur', async () => {
    const { data: row, error } = await trainerA
      .from('participant_reports')
      .insert({ participant_id: f.participantA, version: 99, status: 'final', data, engine_version: 'bilan-test', created_by: f.accounts.participantA.id })
      .select('id, version, status, created_by, finalized_at')
      .single();
    expect(error).toBeNull();
    expect(row).toMatchObject({ version: 1, status: 'draft', created_by: f.accounts.trainerA.id, finalized_at: null });
    reportId = row!.id;
  });

  it('un formateur d’un autre groupe ne peut ni créer ni lire ce bilan', async () => {
    const insert = await trainerB.from('participant_reports').insert({ participant_id: f.participantA, version: 0, data, engine_version: 'x' });
    expect(insert.error).not.toBeNull();
    expect((await trainerB.from('participant_reports').select('id').eq('id', reportId)).data).toEqual([]);
  });

  it('un brouillon n’est visible ni du participant ni de son organisme', async () => {
    expect((await participantA.from('participant_reports').select('id').eq('id', reportId)).data).toEqual([]);
    expect((await memberA.from('participant_reports').select('id').eq('id', reportId)).data).toEqual([]);
  });

  it('le participant et l’organisme ne peuvent pas créer de bilan', async () => {
    expect((await participantA.from('participant_reports').insert({ participant_id: f.participantA, version: 0, data, engine_version: 'x' })).error).not.toBeNull();
    expect((await memberA.from('participant_reports').insert({ participant_id: f.participantA, version: 0, data, engine_version: 'x' })).error).not.toBeNull();
  });

  it('les résultats d’un bilan ne se modifient pas, même par son auteur', async () => {
    const { error } = await trainerA.from('participant_reports').update({ data: { ...data, counts: { observations: 99 } } }).eq('id', reportId);
    expect(error?.message).toMatch(/résultats/);
    const { data: row } = await service.from('participant_reports').select('data').eq('id', reportId).single();
    expect(row!.data).toEqual(data);
  });

  it('une nouvelle génération crée une nouvelle version', async () => {
    const { data: row } = await trainerA.from('participant_reports').insert({ participant_id: f.participantA, version: 0, data, engine_version: 'bilan-test' }).select('version').single();
    expect(row!.version).toBe(2);
  });
});

describe('bilans : validation et diffusion', () => {
  it('un bilan sans texte ne peut pas être validé', async () => {
    const { error } = await trainerA.from('participant_reports').update({ status: 'final' }).eq('id', reportId);
    expect(error).not.toBeNull();
  });

  it('le formateur rédige puis valide ; la date et le validateur sont fixés par la base', async () => {
    expect((await trainerA.from('participant_reports').update({ content, content_source: 'manual' }).eq('id', reportId)).error).toBeNull();
    expect((await trainerA.from('participant_reports').update({ status: 'final' }).eq('id', reportId)).error).toBeNull();
    const { data: row } = await service.from('participant_reports').select('status, finalized_by, finalized_at').eq('id', reportId).single();
    expect(row).toMatchObject({ status: 'final', finalized_by: f.accounts.trainerA.id });
    expect(row!.finalized_at).not.toBeNull();
  });

  it('un bilan validé est figé : ni modification ni suppression', async () => {
    await trainerA.from('participant_reports').update({ content: { ...content, conclusion: 'Réécrit.' } }).eq('id', reportId);
    await trainerA.from('participant_reports').delete().eq('id', reportId);
    const { data: row } = await service.from('participant_reports').select('content').eq('id', reportId).single();
    expect((row!.content as { conclusion: string }).conclusion).toBe('Conclusion.');
  });

  it('le participant et son organisme lisent le bilan validé ; les autres non', async () => {
    expect((await participantA.from('participant_reports').select('id').eq('id', reportId)).data).toHaveLength(1);
    expect((await memberA.from('participant_reports').select('id').eq('id', reportId)).data).toHaveLength(1);
    expect((await participantB.from('participant_reports').select('id').eq('id', reportId)).data).toEqual([]);
    expect((await memberB.from('participant_reports').select('id').eq('id', reportId)).data).toEqual([]);
    expect((await trainerB.from('participant_reports').select('id').eq('id', reportId)).data).toEqual([]);
  });

  it('le participant ne peut pas modifier son bilan', async () => {
    await participantA.from('participant_reports').update({ content: { ...content, conclusion: 'Modifié.' } }).eq('id', reportId);
    const { data: row } = await service.from('participant_reports').select('content').eq('id', reportId).single();
    expect((row!.content as { conclusion: string }).conclusion).toBe('Conclusion.');
  });

  it('chaque étape est journalisée', async () => {
    const { data: logs } = await service.from('audit_logs').select('action').eq('entity_id', reportId);
    expect((logs ?? []).map((log) => log.action)).toEqual(expect.arrayContaining(['report.created', 'report.content_updated', 'report.finalized']));
  });
});
