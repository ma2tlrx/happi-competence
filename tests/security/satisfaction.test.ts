/**
 * Enquêtes de satisfaction et auto-évaluation finale, éprouvées avec de vraies sessions :
 * on ne répond que pour soi, pour un groupe dont on est membre (participant) ou dont
 * l'organisme est le sien (prescripteur), une seule fois ; les formateurs et organismes ne
 * lisent que des agrégats anonymes ; l'auto-évaluation finale reprend le questionnaire initial.
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
const answers: Record<'participant' | 'prescriber', Record<string, number | string>> = { participant: {}, prescriber: {} };

beforeAll(async () => {
  f = await createFixtures();
  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  memberA = await signIn(f.accounts.memberA.email);
  memberB = await signIn(f.accounts.memberB.email);
  participantA = await signIn(f.accounts.participantA.email);
  participantB = await signIn(f.accounts.participantB.email);
  // Les séances des fixtures datent de janvier 2026 : l'enquête à froid est ouverte.
  for (const audience of ['participant', 'prescriber'] as const) {
    const { data } = await service
      .from('satisfaction_questions')
      .select('id, kind, options, satisfaction_survey_versions!inner ( status, satisfaction_surveys!inner ( audience, moment ) )')
      .eq('satisfaction_survey_versions.status', 'published')
      .eq('satisfaction_survey_versions.satisfaction_surveys.audience', audience)
      .eq('satisfaction_survey_versions.satisfaction_surveys.moment', 'cold');
    for (const question of data ?? []) {
      answers[audience][question.id] = question.kind === 'rating' ? 4 : question.kind === 'nps' ? 9 : question.kind === 'choice' ? question.options[0]! : 'Commentaire libre';
    }
  }
});

afterAll(async () => {
  await destroyFixtures(f);
});

describe('satisfaction : réponses', () => {
  it('le participant voit l’enquête à froid de son groupe, et seulement celle-là', async () => {
    const { data } = await participantA.rpc('my_satisfaction_surveys');
    expect((data ?? []).map((row) => [row.group_id, row.moment, row.audience])).toEqual([[f.groupA, 'cold', 'participant']]);
  });

  it('l’enquête à chaud est fermée 90 jours après la fin', async () => {
    const { error } = await participantA.rpc('submit_satisfaction_response', { p_group_id: f.groupA, p_moment: 'hot', p_answers: answers.participant });
    expect(error?.message).toMatch(/pas ouverte/);
  });

  it('un participant ne répond pas pour un groupe dont il n’est pas membre', async () => {
    const { error } = await participantB.rpc('submit_satisfaction_response', { p_group_id: f.groupA, p_moment: 'cold', p_answers: answers.participant });
    expect(error).not.toBeNull();
  });

  it('le participant répond une fois ; une deuxième réponse est refusée', async () => {
    expect((await participantA.rpc('submit_satisfaction_response', { p_group_id: f.groupA, p_moment: 'cold', p_answers: answers.participant })).error).toBeNull();
    const again = await participantA.rpc('submit_satisfaction_response', { p_group_id: f.groupA, p_moment: 'cold', p_answers: answers.participant });
    expect(again.error?.message).toMatch(/déjà répondu/);
  });

  it('le prescripteur répond pour un groupe de sa structure, pas pour celui d’une autre', async () => {
    expect((await memberA.rpc('submit_satisfaction_response', { p_group_id: f.groupA, p_moment: 'cold', p_answers: answers.prescriber })).error).toBeNull();
    expect((await memberB.rpc('submit_satisfaction_response', { p_group_id: f.groupA, p_moment: 'cold', p_answers: answers.prescriber })).error).not.toBeNull();
  });

  it('un formateur ne répond pas aux enquêtes', async () => {
    expect((await trainerA.rpc('submit_satisfaction_response', { p_group_id: f.groupA, p_moment: 'cold', p_answers: answers.participant })).error).not.toBeNull();
  });

  it('aucune écriture directe : ni insertion, ni modification, ni suppression', async () => {
    const { data: own } = await participantA.from('satisfaction_responses').select('id, survey_version_id');
    expect(own).toHaveLength(1);
    const insert = await participantA
      .from('satisfaction_responses')
      .insert({ survey_version_id: own![0]!.survey_version_id, group_id: f.groupA, audience: 'participant', moment: 'hot', participant_id: f.participantA });
    expect(insert.error).not.toBeNull();
    expect((await participantA.from('satisfaction_responses').update({ moment: 'hot' }).eq('id', own![0]!.id)).error).not.toBeNull();
    expect((await participantA.from('satisfaction_answers').delete().eq('response_id', own![0]!.id)).error).not.toBeNull();
    const { data: kept } = await service.from('satisfaction_answers').select('id').eq('response_id', own![0]!.id);
    expect((kept ?? []).length).toBe(Object.keys(answers.participant).length);
  });
});

describe('satisfaction : lecture des résultats', () => {
  it('les réponses brutes ne sont lisibles que par leur auteur', async () => {
    expect((await trainerA.from('satisfaction_responses').select('id')).data).toEqual([]);
    expect((await memberA.from('satisfaction_responses').select('id, participant_id')).data?.every((row) => row.participant_id === null)).toBe(true);
    expect((await participantB.from('satisfaction_responses').select('id')).data).toEqual([]);
    expect((await participantB.from('satisfaction_answers').select('id')).data).toEqual([]);
  });

  it('formateur et organisme du groupe lisent des agrégats anonymes ; verbatims masqués sous 3 réponses', async () => {
    for (const client of [trainerA, memberA]) {
      const { data } = await client.rpc('satisfaction_results', { p_group_ids: [f.groupA] });
      expect((data ?? []).length).toBeGreaterThan(0);
      expect((data ?? []).every((row) => row.respondent === null && row.response_id === null && row.submitted_at === null)).toBe(true);
      expect((data ?? []).filter((row) => row.text_hidden).length).toBeGreaterThan(0);
      expect((data ?? []).every((row) => row.text_value === null)).toBe(true);
    }
  });

  it('un formateur ou un organisme étranger au groupe ne lit rien', async () => {
    for (const client of [trainerB, memberB, participantA]) {
      expect((await client.rpc('satisfaction_results', { p_group_ids: [f.groupA] })).data).toEqual([]);
      expect((await client.rpc('satisfaction_overview', { p_group_ids: [f.groupA] })).data).toEqual([]);
    }
  });

  it('taux de réponse : invités et réponses par destinataire', async () => {
    const { data } = await trainerA.rpc('satisfaction_overview', { p_group_ids: [f.groupA] });
    const cold = (data ?? []).filter((row) => row.moment === 'cold');
    expect(cold.find((row) => row.audience === 'participant')).toMatchObject({ invited: 1, responses: 1, is_open: true });
    expect(cold.find((row) => row.audience === 'prescriber')).toMatchObject({ invited: 1, responses: 1, is_open: true });
  });

  it('chaque réponse est journalisée, sans son contenu', async () => {
    const { data } = await service.from('audit_logs').select('metadata').eq('action', 'satisfaction.submitted').eq('organization_id', f.orgA);
    expect((data ?? []).length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(data)).not.toMatch(/Commentaire libre/);
  });

  it('seul l’administrateur modifie les enquêtes', async () => {
    const { data: version } = await service.from('satisfaction_survey_versions').select('id').eq('status', 'published').limit(1).single();
    expect((await trainerA.rpc('clone_satisfaction_version', { p_source_version_id: version!.id })).error).not.toBeNull();
    await memberA.from('satisfaction_questions').update({ text: 'Modifiée' }).eq('version_id', version!.id);
    expect((await service.from('satisfaction_questions').select('id').eq('text', 'Modifiée')).data).toEqual([]);
  });
});

describe('auto-évaluation finale', () => {
  async function completeInitial(client: Client, participantId: string) {
    const { data: version } = await service.from('questionnaire_versions').select('id, questionnaire_questions ( id, is_active )').eq('status', 'published').single();
    const { data: initial, error } = await client
      .from('self_assessments')
      .insert({ participant_id: participantId, questionnaire_version_id: version!.id, kind: 'initial' })
      .select('id')
      .single();
    expect(error).toBeNull();
    const questions = version!.questionnaire_questions.filter((question) => question.is_active);
    expect((await client.from('self_assessment_answers').insert(questions.map((question) => ({ self_assessment_id: initial!.id, question_id: question.id, value: 3 })))).error).toBeNull();
    expect((await client.from('self_assessments').update({ status: 'completed' }).eq('id', initial!.id)).error).toBeNull();
    return { versionId: version!.id, questions };
  }

  it('refusée tant que le parcours n’est pas terminé', async () => {
    // Le groupe B a encore une séance à venir.
    const { data: outline } = await service.from('program_sessions').select('id').eq('number', 2).limit(1).single();
    await service.from('sessions').insert({ group_id: f.groupB, program_session_id: outline!.id, number: 2, status: 'planned' });
    const { versionId } = await completeInitial(participantB, f.participantB);
    expect((await participantB.rpc('my_final_self_assessment_open')).data).toBe(false);
    const { error } = await participantB.from('self_assessments').insert({ participant_id: f.participantB, questionnaire_version_id: versionId, kind: 'final' });
    expect(error?.message).toMatch(/fin de votre parcours/);
  });

  it('refusée sans auto-évaluation initiale, puis ouverte une seule fois avec le même questionnaire', async () => {
    const { data: version } = await service.from('questionnaire_versions').select('id').eq('status', 'published').single();
    const early = await participantA.from('self_assessments').insert({ participant_id: f.participantA, questionnaire_version_id: version!.id, kind: 'final' });
    expect(early.error?.message).toMatch(/après l’auto-évaluation initiale/);

    const { versionId, questions } = await completeInitial(participantA, f.participantA);
    expect((await participantA.rpc('my_final_self_assessment_open')).data).toBe(true);
    const { data: final, error } = await participantA
      .from('self_assessments')
      .insert({ participant_id: f.participantA, questionnaire_version_id: versionId, kind: 'final' })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect((await participantA.from('self_assessment_answers').insert(questions.map((question) => ({ self_assessment_id: final!.id, question_id: question.id, value: 4 })))).error).toBeNull();
    expect((await participantA.from('self_assessments').update({ status: 'completed' }).eq('id', final!.id)).error).toBeNull();

    // Figée, et unique.
    expect((await participantA.from('self_assessments').update({ comment: 'Modifié' }).eq('id', final!.id)).error).not.toBeNull();
    await participantA.from('self_assessment_answers').update({ value: 1 }).eq('self_assessment_id', final!.id);
    const { data: kept } = await service.from('self_assessment_answers').select('value').eq('self_assessment_id', final!.id);
    expect((kept ?? []).every((row) => row.value === 4)).toBe(true);
    const again = await participantA.from('self_assessments').insert({ participant_id: f.participantA, questionnaire_version_id: versionId, kind: 'final' });
    expect(again.error).not.toBeNull();
  });

  it('un participant ne crée pas l’auto-évaluation finale d’un autre', async () => {
    const { data: version } = await service.from('questionnaire_versions').select('id').eq('status', 'published').single();
    const { error } = await participantB.from('self_assessments').insert({ participant_id: f.participantA, questionnaire_version_id: version!.id, kind: 'final' });
    expect(error).not.toBeNull();
  });

  it('le formateur du participant lit l’auto-évaluation finale, pas un autre formateur', async () => {
    expect((await trainerA.from('self_assessments').select('id').eq('participant_id', f.participantA).eq('kind', 'final')).data).toHaveLength(1);
    expect((await trainerB.from('self_assessments').select('id').eq('participant_id', f.participantA).eq('kind', 'final')).data).toEqual([]);
  });
});
