/**
 * Seconde cotation et fiabilité de la mesure (migration 20261118140000) :
 * - aveugle garanti par la base : tant que sa seconde cotation n'est pas soumise, le
 *   formateur ne lit ni n'écrit l'évaluation officielle (ni les bilans du participant) ;
 * - une seconde cotation ne s'ouvre pas si l'évaluation officielle est déjà commencée par
 *   un autre formateur du groupe, ni pour l'auteur de l'évaluation officielle ;
 * - les secondes cotations ne sont lisibles que par leur auteur et l'administrateur ;
 * - exercices d'étalonnage, réglages et publication : administrateur uniquement.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let trainerA: Client;
let trainerB: Client;
let cotrainer: Client;
let admin: Client;
let participantA: Client;
let sessionA2: string;
let officialA2: string;
let ratingId: string;

beforeAll(async () => {
  f = await createFixtures();
  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  // Comptes temporaires : le membre B devient co-formateur du groupe A, le membre A administrateur.
  await service.from('profiles').update({ role: 'formateur' }).eq('id', f.accounts.memberB.id);
  await service.from('profiles').update({ role: 'admin' }).eq('id', f.accounts.memberA.id);
  await service.from('group_trainers').insert({ group_id: f.groupA, trainer_id: f.accounts.memberB.id });
  cotrainer = await signIn(f.accounts.memberB.email);
  admin = await signIn(f.accounts.memberA.email);
  participantA = await signIn(f.accounts.participantA.email);
  const program = await service.from('groups').select('program_id').eq('id', f.groupA).single();
  const outline = await service.from('program_sessions').select('id').eq('program_id', program.data!.program_id).eq('number', 2).single();
  const created = await service
    .from('sessions')
    .insert({ group_id: f.groupA, program_session_id: outline.data!.id, number: 2, status: 'completed', scheduled_date: '2026-01-17', trainer_id: f.accounts.trainerA.id })
    .select('id')
    .single();
  sessionA2 = created.data!.id;
});

afterAll(async () => {
  await service.from('profiles').update({ role: 'organisme' }).in('id', [f.accounts.memberA.id, f.accounts.memberB.id]);
  await destroyFixtures(f);
});

describe('ouverture d’une seconde cotation', () => {
  it('refusée quand l’évaluation officielle est déjà commencée (aveugle impossible)', async () => {
    const { data, error } = await cotrainer.rpc('start_second_rating', { p_session_id: f.sessionA });
    expect(error).toBeNull();
    expect(data).toMatchObject({ created: 0, skipped: [{ participant_id: f.participantA, reason: 'not_blind' }] });
  });

  it('refusée à l’animateur de la séance et aux formateurs hors du groupe', async () => {
    expect((await trainerA.rpc('start_second_rating', { p_session_id: sessionA2 })).error?.code).toBe('P0001');
    expect((await trainerB.rpc('start_second_rating', { p_session_id: sessionA2 })).error?.code).toBe('42501');
    expect((await participantA.rpc('start_second_rating', { p_session_id: sessionA2 })).error?.code).toBe('42501');
  });

  it('ouverte pour le co-formateur tant que l’évaluation officielle est vide', async () => {
    const { data, error } = await cotrainer.rpc('start_second_rating', { p_session_id: sessionA2 });
    expect(error).toBeNull();
    expect(data).toMatchObject({ created: 1 });
    const mine = await cotrainer.rpc('get_my_second_ratings', { p_session_id: sessionA2 });
    expect(mine.data).toHaveLength(1);
    ratingId = mine.data![0]!.rating_id;
  });

  it('aucune écriture directe dans les tables', async () => {
    expect((await cotrainer.from('calibration_ratings').insert({ session_id: f.sessionA, participant_id: f.participantA, rater_id: f.accounts.memberB.id, origin: 'co_trainer' })).error).not.toBeNull();
    expect((await cotrainer.from('calibration_scores').insert({ rating_id: ratingId, skill_id: f.skillId, score: 1 })).error).not.toBeNull();
    expect((await cotrainer.from('calibration_ratings').update({ status: 'submitted' }).eq('id', ratingId).select('id')).data ?? []).toEqual([]);
  });
});

describe('aveugle garanti côté base', () => {
  beforeAll(async () => {
    // Le formateur officiel saisit et valide pendant que la seconde cotation est ouverte.
    const draft = await trainerA.rpc('save_evaluation_draft', {
      p_session_id: sessionA2,
      p_participant_id: f.participantA,
      p_scores: [{ skill_id: f.skillId, score: 3 }],
      p_comments: { observation: 'Observation officielle', private: 'Note privée officielle' },
    });
    officialA2 = draft.data as string;
    expect((await trainerA.rpc('validate_evaluation', { p_evaluation_id: officialA2 })).error).toBeNull();
    await trainerA.from('participant_reports').insert({ participant_id: f.participantA, version: 0, data: { engineVersion: 'test' }, engine_version: 'test' });
  });

  it('le second observateur ne lit ni l’évaluation, ni ses notes, commentaires, historique, ni les bilans', async () => {
    expect((await cotrainer.from('evaluations').select('id').eq('id', officialA2)).data).toEqual([]);
    expect((await cotrainer.from('evaluation_scores').select('score').eq('evaluation_id', officialA2)).data).toEqual([]);
    expect((await cotrainer.from('evaluation_comments').select('body').eq('evaluation_id', officialA2)).data).toEqual([]);
    expect((await cotrainer.from('evaluation_history').select('id').eq('evaluation_id', officialA2)).data).toEqual([]);
    expect((await cotrainer.from('participant_reports').select('id').eq('participant_id', f.participantA)).data).toEqual([]);
    // Les autres évaluations du groupe restent visibles.
    expect((await cotrainer.from('evaluations').select('id').eq('id', f.evaluationA)).data).toHaveLength(1);
    // Le formateur officiel, lui, voit tout.
    expect((await trainerA.from('evaluation_scores').select('score').eq('evaluation_id', officialA2)).data).toHaveLength(1);
    expect((await trainerA.from('participant_reports').select('id').eq('participant_id', f.participantA)).data!.length).toBeGreaterThan(0);
  });

  it('il ne peut pas écrire dans l’évaluation officielle, même par les fonctions de modification', async () => {
    const draft = await cotrainer.rpc('save_evaluation_draft', { p_session_id: sessionA2, p_participant_id: f.participantA, p_scores: [{ skill_id: f.skillId, score: 1 }] });
    expect(draft.error).not.toBeNull();
    const amend = await cotrainer.rpc('amend_evaluation', { p_evaluation_id: officialA2, p_reason: 'Tentative test', p_scores: [{ skill_id: f.skillId, score: 1 }] });
    expect(amend.error?.code).toBe('42501');
    const after = await service.from('evaluation_scores').select('score').eq('evaluation_id', officialA2).single();
    expect(Number(after.data!.score)).toBe(3);
  });

  it('aucun retour de comparaison avant la soumission', async () => {
    expect((await cotrainer.rpc('get_second_rating_feedback', { p_rating_id: ratingId })).error?.code).toBe('42501');
  });

  it('les secondes cotations ne sont lisibles que par leur auteur et l’administrateur', async () => {
    expect((await cotrainer.from('calibration_ratings').select('id').eq('id', ratingId)).data).toHaveLength(1);
    expect((await admin.from('calibration_ratings').select('id').eq('id', ratingId)).data).toHaveLength(1);
    expect((await trainerA.from('calibration_ratings').select('id').eq('id', ratingId)).data).toEqual([]);
    expect((await trainerB.from('calibration_ratings').select('id').eq('id', ratingId)).data).toEqual([]);
    expect((await participantA.from('calibration_ratings').select('id').eq('id', ratingId)).data).toEqual([]);
    expect((await trainerA.rpc('get_my_second_ratings', { p_session_id: sessionA2 })).data).toEqual([]);
  });

  it('refuse une note hors échelle ou hors pas, et la saisie par un autre compte', async () => {
    expect((await cotrainer.rpc('save_second_rating', { p_rating_id: ratingId, p_scores: [{ skill_id: f.skillId, score: 99 }] })).error?.code).toBe('P0001');
    expect((await trainerA.rpc('save_second_rating', { p_rating_id: ratingId, p_scores: [{ skill_id: f.skillId, score: 2 }] })).error?.code).toBe('42501');
  });

  it('après soumission : cotation figée, aveugle levé, retour disponible, journalisé', async () => {
    expect((await cotrainer.rpc('save_second_rating', { p_rating_id: ratingId, p_scores: [{ skill_id: f.skillId, score: 2 }], p_comment: 'Remarque' })).error).toBeNull();
    expect((await cotrainer.rpc('submit_second_rating', { p_rating_id: ratingId })).error).toBeNull();
    expect((await cotrainer.rpc('save_second_rating', { p_rating_id: ratingId, p_scores: [{ skill_id: f.skillId, score: 4 }] })).error?.code).toBe('P0001');
    expect((await cotrainer.from('evaluation_scores').select('score').eq('evaluation_id', officialA2)).data).toHaveLength(1);
    const feedback = await cotrainer.rpc('get_second_rating_feedback', { p_rating_id: ratingId });
    expect(feedback.data).toMatchObject({ validated: true, scores: { [f.skillId]: 3 } });
    const logs = await service.from('audit_logs').select('id').eq('action', 'calibration.submitted').eq('entity_id', ratingId);
    expect(logs.data).toHaveLength(1);
  });

  it('la seconde cotation n’entre pas dans l’évaluation officielle (passeport, bilan)', async () => {
    const scores = await service.from('evaluation_scores').select('score').eq('evaluation_id', officialA2);
    expect(scores.data!.map((row) => Number(row.score))).toEqual([3]);
  });
});

describe('exercices d’étalonnage et réglages', () => {
  it('l’administrateur invite des formateurs ; l’auteur officiel et un co-formateur non aveugle sont écartés', async () => {
    const { data, error } = await admin.rpc('create_calibration_exercise', {
      p_session_id: f.sessionA,
      p_title: 'Étalonnage test',
      p_instructions: 'Support : déroulé écrit.',
      p_participant_ids: [f.participantA],
      p_rater_ids: [f.accounts.trainerB.id, f.accounts.trainerA.id, f.accounts.memberB.id],
    });
    expect(error).toBeNull();
    const result = data as { created: number; skipped: { rater_id: string; reason: string }[] };
    expect(result.created).toBe(1);
    expect(Object.fromEntries(result.skipped.map((s) => [s.rater_id, s.reason]))).toEqual({ [f.accounts.trainerA.id]: 'official_evaluator', [f.accounts.memberB.id]: 'not_blind' });
    // L'invité voit son affectation (prénom et initiale), jamais l'évaluation officielle.
    const mine = await trainerB.rpc('get_my_second_ratings', {});
    expect(mine.data?.[0]).toMatchObject({ exercise_title: 'Étalonnage test', origin: 'exercise' });
    expect(mine.data?.[0]?.participant_label).toMatch(/^\S+ .\.$/);
    expect((await trainerB.from('evaluations').select('id').eq('session_id', f.sessionA)).data).toEqual([]);
  });

  it('création d’exercice et réglages réservés à l’administrateur', async () => {
    expect((await trainerA.rpc('create_calibration_exercise', { p_session_id: f.sessionA, p_title: 'X', p_instructions: null, p_participant_ids: [f.participantA], p_rater_ids: [f.accounts.trainerB.id] })).error?.code).toBe('42501');
    expect((await trainerA.from('reliability_settings').select('min_pairs')).data).toEqual([]);
    expect((await trainerA.from('reliability_settings').update({ min_pairs: 10 }).eq('id', true).select('id')).data ?? []).toEqual([]);
    expect((await trainerA.rpc('log_reliability_export', { p_rows: 0, p_include_demo: false })).error?.code).toBe('42501');
    const before = await admin.from('reliability_settings').select('min_pairs').single();
    expect((await admin.from('reliability_settings').update({ min_pairs: 45 }).eq('id', true).select('min_pairs').single()).data).toEqual({ min_pairs: 45 });
    expect((await admin.from('reliability_settings').update({ min_pairs: 5 }).eq('id', true)).error).not.toBeNull();
    await admin.from('reliability_settings').update({ min_pairs: before.data!.min_pairs }).eq('id', true);
  });

  it('rien n’est publié par défaut ; publier exige un instantané', async () => {
    const current = await service.from('reliability_settings').select('publish').single();
    if (!current.data?.publish) expect((await anonymous().rpc('get_public_reliability')).data).toBeNull();
    expect((await admin.from('reliability_settings').update({ publish: true, snapshot: null }).eq('id', true)).error).not.toBeNull();
  });

  it('cascade : supprimer le participant supprime ses secondes cotations', async () => {
    const before = await service.from('calibration_ratings').select('id').eq('participant_id', f.participantA);
    expect(before.data!.length).toBeGreaterThan(0);
    await service.from('participants').delete().eq('id', f.participantA);
    expect((await service.from('calibration_ratings').select('id').eq('participant_id', f.participantA)).data).toEqual([]);
  });
});
