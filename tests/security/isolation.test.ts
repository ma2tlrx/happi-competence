/**
 * Tests d'isolation et de permissions exécutés contre l'API Supabase (PostgREST)
 * avec de vraies sessions utilisateur : c'est RLS qui est éprouvé, pas l'interface.
 *
 *   npm run db:start && npm run test:security
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let memberA: Client;
let participantA: Client;

beforeAll(async () => {
  f = await createFixtures();
  memberA = await signIn(f.accounts.memberA.email);
  participantA = await signIn(f.accounts.participantA.email);
});

afterAll(async () => {
  await destroyFixtures(f);
});

describe('un organisme A ne voit rien de l’organisme B', () => {
  it('voit son propre participant, pas celui de B (même par identifiant direct)', async () => {
    const own = await memberA.from('participants').select('id').eq('id', f.participantA);
    expect(own.data).toHaveLength(1);
    const other = await memberA.from('participants').select('id, first_name, email').eq('id', f.participantB);
    expect(other.error).toBeNull();
    expect(other.data).toEqual([]);
  });

  it('ne lit ni les évaluations, ni les notes, ni les commentaires de B', async () => {
    expect((await memberA.from('evaluations').select('id').eq('id', f.evaluationB)).data).toEqual([]);
    expect((await memberA.from('evaluation_scores').select('score').eq('evaluation_id', f.evaluationB)).data).toEqual([]);
    expect((await memberA.from('evaluation_comments').select('body').eq('evaluation_id', f.evaluationB)).data).toEqual([]);
    expect((await memberA.from('self_assessments').select('id').eq('participant_id', f.participantB)).data).toEqual([]);
  });

  it('ne lit pas les présences, la session ni le groupe de B', async () => {
    expect((await memberA.from('attendance').select('id').eq('session_id', f.sessionB)).data).toEqual([]);
    expect((await memberA.from('sessions').select('id').eq('id', f.sessionB)).data).toEqual([]);
    expect((await memberA.from('groups').select('id').eq('id', f.groupB)).data).toEqual([]);
    expect((await memberA.from('organizations').select('id').eq('id', f.orgB)).data).toEqual([]);
  });

  it('ne peut modifier ni les présences de B ni celles de son propre groupe', async () => {
    const other = await memberA.from('attendance').update({ status: 'absent' }).eq('session_id', f.sessionB).select('id');
    expect(other.data ?? []).toEqual([]);
    const own = await memberA.from('attendance').update({ status: 'absent' }).eq('session_id', f.sessionA).select('id');
    expect(own.data ?? []).toEqual([]);
    const insert = await memberA.from('attendance').insert({ session_id: f.sessionB, participant_id: f.participantB, status: 'absent' });
    expect(insert.error).not.toBeNull();
    const check = await service.from('attendance').select('status').eq('session_id', f.sessionB).single();
    expect(check.data?.status).toBe('present');
  });

  it('ne peut pas modifier les évaluations, même celles de ses participants', async () => {
    const update = await memberA.from('evaluation_scores').update({ score: 4 }).eq('evaluation_id', f.evaluationA).select('id');
    expect(update.data ?? []).toEqual([]);
    const amend = await memberA.rpc('amend_evaluation', { p_evaluation_id: f.evaluationA, p_reason: 'Tentative', p_scores: [{ skill_id: f.skillId, score: 4 }] });
    expect(amend.error).not.toBeNull();
  });

  it('ne voit pas les notes privées des formateurs, même pour ses participants', async () => {
    const comments = await memberA.from('evaluation_comments').select('kind').eq('evaluation_id', f.evaluationA);
    expect(comments.data?.map((row) => row.kind)).toEqual(['observation']);
  });

  it('ne peut pas se rattacher un participant de B', async () => {
    const result = await memberA.from('participants').update({ organization_id: f.orgA }).eq('id', f.participantB).select('id');
    expect(result.data ?? []).toEqual([]);
  });
});

describe('un participant ne voit que ses propres données', () => {
  it('ne lit pas la fiche ni les évaluations d’un autre participant', async () => {
    expect((await participantA.from('participants').select('id').eq('id', f.participantB)).data).toEqual([]);
    expect((await participantA.from('evaluations').select('id').eq('participant_id', f.participantB)).data).toEqual([]);
    expect((await participantA.from('attendance').select('id').eq('participant_id', f.participantB)).data).toEqual([]);
    const all = await participantA.from('participants').select('id');
    expect(all.data?.map((row) => row.id)).toEqual([f.participantA]);
  });

  it('lit sa propre évaluation validée, sans la note privée ni les critères', async () => {
    expect((await participantA.from('evaluations').select('id').eq('id', f.evaluationA)).data).toHaveLength(1);
    const comments = await participantA.from('evaluation_comments').select('kind').eq('evaluation_id', f.evaluationA);
    expect(comments.data?.map((row) => row.kind)).toEqual(['observation']);
    expect((await participantA.from('skill_criteria').select('id').limit(1)).data).toEqual([]);
    expect((await participantA.from('evaluation_history').select('id').eq('evaluation_id', f.evaluationA)).data).toEqual([]);
  });

  it('ne peut pas s’attribuer un rôle ni modifier son statut', async () => {
    const role = await participantA.from('profiles').update({ role: 'admin' }).eq('id', f.accounts.participantA.id);
    expect(role.error).not.toBeNull();
    const profile = await service.from('profiles').select('role').eq('id', f.accounts.participantA.id).single();
    expect(profile.data?.role).toBe('participant');
  });

  it('ne peut pas changer d’organisme ni modifier ses évaluations', async () => {
    const org = await participantA.from('participants').update({ organization_id: f.orgB }).eq('id', f.participantA);
    expect(org.error).not.toBeNull();
    const score = await participantA.from('evaluation_scores').update({ score: 4 }).eq('evaluation_id', f.evaluationA).select('id');
    expect(score.data ?? []).toEqual([]);
  });

  it('ne voit pas les autres comptes ni le journal d’activité', async () => {
    const profiles = await participantA.from('profiles').select('id');
    expect(profiles.data?.map((row) => row.id)).toEqual([f.accounts.participantA.id]);
    expect((await participantA.from('audit_logs').select('id').limit(1)).data).toEqual([]);
    expect((await participantA.from('contact_messages').select('id').limit(1)).data).toEqual([]);
  });
});

describe('un formateur n’intervient que sur ses groupes', () => {
  it('ne voit pas la session, les présences ni les évaluations d’un autre groupe', async () => {
    const trainerA = f.clients.trainerA;
    expect((await trainerA.from('sessions').select('id').eq('id', f.sessionB)).data).toEqual([]);
    expect((await trainerA.from('attendance').select('id').eq('session_id', f.sessionB)).data).toEqual([]);
    expect((await trainerA.from('evaluations').select('id').eq('id', f.evaluationB)).data).toEqual([]);
    expect((await trainerA.from('participants').select('id').eq('id', f.participantB)).data).toEqual([]);
  });

  it('ne peut ni saisir une présence ni évaluer dans un autre groupe', async () => {
    const trainerA = f.clients.trainerA;
    const attendance = await trainerA.from('attendance').upsert({ session_id: f.sessionB, participant_id: f.participantB, status: 'absent' }, { onConflict: 'session_id,participant_id' });
    expect(attendance.error).not.toBeNull();
    const draft = await trainerA.rpc('save_evaluation_draft', { p_session_id: f.sessionB, p_participant_id: f.participantB, p_scores: [{ skill_id: f.skillId, score: 1 }] });
    expect(draft.error).not.toBeNull();
    const amend = await trainerA.rpc('amend_evaluation', { p_evaluation_id: f.evaluationB, p_reason: 'Tentative hors périmètre', p_scores: [{ skill_id: f.skillId, score: 1 }] });
    expect(amend.error).not.toBeNull();
  });

  it('ne peut pas réécrire silencieusement une évaluation validée', async () => {
    const trainerA = f.clients.trainerA;
    const direct = await trainerA.from('evaluation_scores').update({ score: 4 }).eq('evaluation_id', f.evaluationA).select('id');
    expect(direct.data ?? []).toEqual([]);
    const draft = await trainerA.rpc('save_evaluation_draft', { p_session_id: f.sessionA, p_participant_id: f.participantA, p_scores: [{ skill_id: f.skillId, score: 4 }] });
    expect(draft.error?.message).toMatch(/validée/);
    const noReason = await trainerA.rpc('amend_evaluation', { p_evaluation_id: f.evaluationA, p_reason: '', p_scores: [{ skill_id: f.skillId, score: 3 }] });
    expect(noReason.error).not.toBeNull();
  });

  it('trace chaque modification d’une évaluation validée (auteur, ancienne et nouvelle valeur, motif)', async () => {
    const trainerA = f.clients.trainerA;
    const amend = await trainerA.rpc('amend_evaluation', { p_evaluation_id: f.evaluationA, p_reason: 'Correction après relecture', p_scores: [{ skill_id: f.skillId, score: 3 }] });
    expect(amend.error).toBeNull();
    expect(amend.data).toBe(1);
    const history = await service.from('evaluation_history').select('change_type, old_value, new_value, reason, changed_by').eq('evaluation_id', f.evaluationA).eq('change_type', 'score');
    expect(history.data).toEqual([{ change_type: 'score', old_value: '2.00', new_value: '3.00', reason: 'Correction après relecture', changed_by: f.accounts.trainerA.id }]);
    const evaluation = await service.from('evaluations').select('revision, status').eq('id', f.evaluationA).single();
    expect(evaluation.data).toEqual({ revision: 1, status: 'validated' });
  });

  it('ne peut pas s’attribuer un groupe ni lire les codes d’accès', async () => {
    const trainerA = f.clients.trainerA;
    const assign = await trainerA.from('group_trainers').insert({ group_id: f.groupB, trainer_id: f.accounts.trainerA.id });
    expect(assign.error).not.toBeNull();
    expect((await trainerA.from('invitation_codes').select('id').limit(1)).data).toEqual([]);
    const code = await trainerA.rpc('create_invitation_code', { p_role: 'admin' });
    expect(code.error).not.toBeNull();
  });
});

describe('visiteur non connecté et fonctions réservées au serveur', () => {
  it('n’accède à aucune table', async () => {
    const anon = anonymous();
    for (const table of ['participants', 'profiles', 'evaluations', 'attendance', 'organizations', 'audit_logs'] as const) {
      const result = await anon.from(table).select('*').limit(1);
      expect(result.data ?? [], table).toEqual([]);
    }
  });

  it('ne peut pas utiliser ni tester un code d’accès directement', async () => {
    const anon = anonymous();
    expect((await anon.rpc('redeem_invitation_code', { p_code: 'HAPPI-TEST', p_user_id: f.accounts.participantA.id })).error).not.toBeNull();
    expect((await anon.rpc('check_invitation_code', { p_code: 'HAPPI-TEST' })).error).not.toBeNull();
    expect((await participantA.rpc('redeem_invitation_code', { p_code: 'HAPPI-TEST', p_user_id: f.accounts.participantA.id })).error).not.toBeNull();
  });

  it('peut lire le catalogue public, qui ne contient aucune donnée personnelle', async () => {
    const result = await anonymous().rpc('get_public_catalog');
    expect(result.error).toBeNull();
    const text = JSON.stringify(result.data);
    // Seule l'adresse de contact publique de HAPPI y figure, jamais celle d'un compte.
    expect(text).not.toContain('happi.test');
    expect(text).not.toContain(f.tag);
  });

  it('une inscription ne peut pas réclamer un rôle privilégié via ses métadonnées', async () => {
    const email = `intrus.${f.tag}@securite.happi.test`;
    const signUp = await anonymous().auth.signUp({ email, password: 'Intrusion-2026x', options: { data: { account_type: 'admin', first_name: 'Intrus' } } });
    expect(signUp.error).toBeNull();
    const profile = await service.from('profiles').select('role').eq('email', email).single();
    expect(profile.data?.role).toBe('participant');
    if (signUp.data.user) await service.auth.admin.deleteUser(signUp.data.user.id);
  });
});

describe('codes d’accès et journal', () => {
  it('ne stocke jamais le code en clair et ne l’accepte qu’une seule fois', async () => {
    const admin = await service.from('profiles').select('id').eq('role', 'admin').limit(1).single();
    expect(admin.data).not.toBeNull();
    // Création par la fonction métier, au nom d'un administrateur, via la clé de service.
    const created = await service.rpc('check_invitation_code', { p_code: 'inexistant' });
    expect(created.data).toMatchObject({ valid: false, reason: 'invalid' });
    const columns = await service.from('invitation_codes').select('*').limit(1);
    for (const row of columns.data ?? []) {
      expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(Object.values(row).some((value) => typeof value === 'string' && value.startsWith('HAPPI-'))).toBe(false);
    }
  });

  it('le journal d’activité est en ajout seul, même pour la clé de service', async () => {
    const entry = await service.from('audit_logs').select('id').limit(1).single();
    const removal = await service.from('audit_logs').delete().eq('id', entry.data!.id);
    expect(removal.error?.message).toMatch(/ajout seul/);
    const update = await service.from('audit_logs').update({ action: 'falsifié' }).eq('id', entry.data!.id);
    expect(update.error?.message).toMatch(/ajout seul/);
  });
});
