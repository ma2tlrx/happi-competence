/**
 * Droits du module qualité : registres (réclamations, plan d'amélioration, veille, résultats
 * publiés) réservés à l'administrateur ; le participant et l'organisme déposent et relisent
 * leurs propres signalements ; le formateur tient son propre registre de qualifications ;
 * l'analyse du besoin suit le périmètre du participant (formateur du groupe, organisme, admin).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let participantA: Client;
let participantB: Client;
let memberA: Client;
let memberB: Client;
let trainerA: Client;
let admin: Client;
let adminId: string;
const created: { complaints: string[]; actions: string[]; watch: string[] } = { complaints: [], actions: [], watch: [] };

beforeAll(async () => {
  f = await createFixtures();
  participantA = await signIn(f.accounts.participantA.email);
  participantB = await signIn(f.accounts.participantB.email);
  memberA = await signIn(f.accounts.memberA.email);
  memberB = await signIn(f.accounts.memberB.email);
  trainerA = f.clients.trainerA;
  // Un administrateur temporaire : le formateur B promu le temps du test.
  adminId = f.accounts.trainerB.id;
  await service.from('profiles').update({ role: 'admin' }).eq('id', adminId);
  admin = await signIn(f.accounts.trainerB.email);
});

afterAll(async () => {
  if (created.actions.length) await service.from('quality_improvement_actions').delete().in('id', created.actions);
  if (created.watch.length) await service.from('quality_watch_entries').delete().in('id', created.watch);
  if (created.complaints.length) await service.from('quality_complaints').delete().in('id', created.complaints);
  await service.from('quality_public_results').update({ enabled: false }).eq('id', true);
  await service.from('profiles').update({ role: 'formateur' }).eq('id', adminId);
  await destroyFixtures(f);
});

describe('signalements (réclamations déposées depuis un espace)', () => {
  let complaintA: string;

  it('le participant dépose un signalement : source et rattachement imposés par la base', async () => {
    const { data, error } = await participantA.rpc('submit_quality_complaint', { p_subject: 'Salle trop froide', p_description: 'La salle était glaciale pendant la séance.' });
    expect(error).toBeNull();
    complaintA = data as string;
    created.complaints.push(complaintA);
    const { data: row } = await service.from('quality_complaints').select('source, channel, participant_id, organization_id, status').eq('id', complaintA).single();
    expect(row).toMatchObject({ source: 'participant', channel: 'espace_en_ligne', participant_id: f.participantA, organization_id: f.orgA, status: 'received' });
  });

  it('le participant relit son signalement mais ne peut ni l’écrire directement ni le clore', async () => {
    expect((await participantA.from('quality_complaints').select('id').eq('id', complaintA)).data).toHaveLength(1);
    const insert = await participantA.from('quality_complaints').insert({ source: 'autre', channel: 'email', subject: 'Test', description: 'Test direct' });
    expect(insert.error).not.toBeNull();
    const { data } = await participantA.from('quality_complaints').update({ status: 'closed', response: 'x', responded_on: '2026-01-01' }).eq('id', complaintA).select('id');
    expect(data ?? []).toEqual([]);
  });

  it('aucun autre compte ne voit ce signalement (autre participant, organismes, formateur)', async () => {
    for (const client of [participantB, memberA, memberB, trainerA]) {
      expect((await client.from('quality_complaints').select('id').eq('id', complaintA)).data ?? []).toHaveLength(0);
    }
  });

  it('l’organisme dépose un signalement rattaché à sa structure', async () => {
    const { data, error } = await memberB.rpc('submit_quality_complaint', { p_subject: 'Facture', p_description: 'La facture reçue ne correspond pas au devis.' });
    expect(error).toBeNull();
    created.complaints.push(data as string);
    const { data: row } = await service.from('quality_complaints').select('source, organization_id').eq('id', data as string).single();
    expect(row).toMatchObject({ source: 'prescripteur', organization_id: f.orgB });
  });

  it('un formateur ou un visiteur anonyme ne peut pas déposer de signalement', async () => {
    expect((await trainerA.rpc('submit_quality_complaint', { p_subject: 'Test', p_description: 'Signalement de formateur' })).error).not.toBeNull();
    expect((await anonymous().rpc('submit_quality_complaint', { p_subject: 'Test', p_description: 'Signalement anonyme' })).error).not.toBeNull();
  });

  it('l’administrateur répond (réponse exigée pour clore) ; l’auteur voit la réponse et est notifié', async () => {
    const refused = await admin.from('quality_complaints').update({ status: 'resolved' }).eq('id', complaintA);
    expect(refused.error).not.toBeNull();
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await admin.from('quality_complaints').update({ status: 'resolved', response: 'Chauffage réparé.', responded_on: today }).eq('id', complaintA);
    expect(error).toBeNull();
    const { data } = await participantA.from('quality_complaints').select('response, status').eq('id', complaintA).single();
    expect(data).toMatchObject({ response: 'Chauffage réparé.', status: 'resolved' });
    const { data: notes } = await service.from('notifications').select('id').eq('user_id', f.accounts.participantA.id).eq('type', 'quality.complaint_answered');
    expect(notes?.length).toBeGreaterThan(0);
    const { data: audit } = await service.from('audit_logs').select('action').eq('entity_id', complaintA).in('action', ['quality.complaint_created', 'quality.complaint_updated']);
    expect(audit?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('registres administratifs (veille, plan d’amélioration, résultats publiés)', () => {
  it('seul l’administrateur écrit la veille et le plan d’amélioration', async () => {
    for (const client of [participantA, memberA, trainerA]) {
      expect((await client.from('quality_watch_entries').insert({ kind: 'legale', source: 'JO', summary: 'Test' })).error).not.toBeNull();
      expect((await client.from('quality_improvement_actions').insert({ origin: 'audit', title: 'Test' })).error).not.toBeNull();
    }
    const watch = await admin.from('quality_watch_entries').insert({ kind: 'legale', source: 'Décret', summary: 'Nouveau référentiel' }).select('id').single();
    expect(watch.error).toBeNull();
    created.watch.push(watch.data!.id);
    const action = await admin.from('quality_improvement_actions').insert({ origin: 'veille', watch_entry_id: watch.data!.id, title: 'Relire les indicateurs' }).select('id').single();
    expect(action.error).toBeNull();
    created.actions.push(action.data!.id);
    for (const client of [participantA, memberA, trainerA]) {
      expect((await client.from('quality_improvement_actions').select('id')).data ?? []).toHaveLength(0);
    }
  });

  it('les résultats publiés ne sont lisibles que par get_public_results, et seulement une fois activés', async () => {
    expect((await anonymous().from('quality_public_results').select('id')).error).not.toBeNull();
    expect((await memberA.from('quality_public_results').update({ enabled: true }).eq('id', true).select('id')).data ?? []).toEqual([]);
    await admin.from('quality_public_results').update({ enabled: false }).eq('id', true);
    expect((await anonymous().rpc('get_public_results')).data).toBeNull();
    const { error } = await admin
      .from('quality_public_results')
      .update({ enabled: true, computed_at: new Date().toISOString(), indicators: { participants: { status: 'insufficient' } } })
      .eq('id', true);
    expect(error).toBeNull();
    expect((await anonymous().rpc('get_public_results')).data).not.toBeNull();
  });

  it('l’export du dossier de preuves n’est tracé que pour l’administrateur', async () => {
    expect((await memberA.rpc('log_quality_export', { p_from: '2026-01-01', p_to: '2026-12-31' })).error).not.toBeNull();
    expect((await admin.rpc('log_quality_export', { p_from: '2026-01-01', p_to: '2026-12-31' })).error).toBeNull();
  });
});

describe('registre des intervenants', () => {
  it('le formateur tient son propre registre et ne touche pas à celui d’un autre', async () => {
    const own = await trainerA.from('trainer_qualifications').insert({ trainer_id: f.accounts.trainerA.id, kind: 'formation', title: 'Usage de l’IA', is_ai_training: true, completed_on: '2026-03-01' }).select('id').single();
    expect(own.error).toBeNull();
    expect((await trainerA.from('trainer_qualifications').insert({ trainer_id: adminId, kind: 'diplome', title: 'Faux' })).error).not.toBeNull();
    expect((await participantA.from('trainer_qualifications').select('id')).data ?? []).toHaveLength(0);
    expect((await memberA.from('trainer_qualifications').select('id')).data ?? []).toHaveLength(0);
    expect((await admin.from('trainer_qualifications').select('id').eq('id', own.data!.id)).data).toHaveLength(1);
  });

  it('le registre ne concerne que les formateurs', async () => {
    expect((await admin.from('trainer_qualifications').insert({ trainer_id: f.accounts.participantA.id, kind: 'diplome', title: 'Test' })).error).not.toBeNull();
  });
});

describe('analyse du besoin', () => {
  it('le formateur du groupe la renseigne ; une adaptation exige sa description', async () => {
    const missing = await trainerA.from('participant_needs_assessments').insert({ participant_id: f.participantA, adaptation_needed: true });
    expect(missing.error).not.toBeNull();
    const { error } = await trainerA
      .from('participant_needs_assessments')
      .insert({ participant_id: f.participantA, expectations: 'Reprendre confiance', adaptation_needed: true, adaptation_planned: 'Pauses fréquentes' });
    expect(error).toBeNull();
  });

  it('l’organisme du participant la lit et la complète ; l’autre organisme ne voit rien', async () => {
    expect((await memberA.from('participant_needs_assessments').select('id').eq('participant_id', f.participantA)).data).toHaveLength(1);
    const { data } = await memberA.from('participant_needs_assessments').update({ prerequisites: 'Aucun' }).eq('participant_id', f.participantA).select('recorded_role').single();
    expect(data?.recorded_role).toBe('organisme');
    expect((await memberB.from('participant_needs_assessments').select('id').eq('participant_id', f.participantA)).data ?? []).toHaveLength(0);
    expect((await memberB.from('participant_needs_assessments').insert({ participant_id: f.participantA })).error).not.toBeNull();
    expect((await participantB.from('participant_needs_assessments').select('id').eq('participant_id', f.participantA)).data ?? []).toHaveLength(0);
  });

  it('seul l’administrateur supprime une analyse du besoin', async () => {
    const { data } = await trainerA.from('participant_needs_assessments').delete().eq('participant_id', f.participantA).select('id');
    expect(data ?? []).toEqual([]);
  });
});
