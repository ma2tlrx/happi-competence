/**
 * Prescription en ligne (referrals) : un organisme ne voit et n'annule que ses orientations, un
 * participant ne lit aucune orientation (il confirme seulement ses consentements), seuls les
 * formateurs du groupe (ou l'administrateur) affectent une personne, la capacité d'un groupe est
 * réservée à l'administrateur, et l'historique n'est pas modifiable.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let memberA: Client;
let memberB: Client;
let participantA: Client;
let trainerA: Client;
let trainerB: Client;
let referralId: string;
let duplicateId: string;
const createdParticipants: string[] = [];

function row(organizationId: string, email: string, extra: Record<string, unknown> = {}) {
  return {
    organization_id: organizationId,
    first_name: 'Orientée',
    last_name: 'Test',
    email,
    reason: 'Orientation créée par les tests de sécurité.',
    information_acknowledged_at: new Date().toISOString(),
    information_version: 'test',
    consent_share_results: true,
    ...extra,
  };
}

beforeAll(async () => {
  f = await createFixtures();
  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  memberA = await signIn(f.accounts.memberA.email);
  memberB = await signIn(f.accounts.memberB.email);
  participantA = await signIn(f.accounts.participantA.email);
  const { data, error } = await memberA.from('referrals').insert(row(f.orgA, `orientee.${f.tag}@securite.happi.test`)).select('id, status, referent_id').single();
  if (error) throw new Error(error.message);
  referralId = data.id;
  expect(data.status).toBe('sent');
  expect(data.referent_id).toBe(f.accounts.memberA.id);
  // Orientation d'une personne qui a déjà une fiche (participant A).
  const duplicate = await memberA.from('referrals').insert(row(f.orgA, f.accounts.participantA.email)).select('id').single();
  if (duplicate.error) throw new Error(duplicate.error.message);
  duplicateId = duplicate.data.id;
});

afterAll(async () => {
  await service.from('referrals').delete().in('organization_id', [f.orgA, f.orgB]);
  if (createdParticipants.length) await service.from('participants').delete().in('id', createdParticipants);
  await destroyFixtures(f);
});

describe('cloisonnement des orientations', () => {
  it('un autre organisme ne voit ni l’orientation ni son historique', async () => {
    expect((await memberB.from('referrals').select('id').eq('id', referralId)).data).toEqual([]);
    expect((await memberB.from('referral_events').select('id').eq('referral_id', referralId)).data).toEqual([]);
  });

  it('un organisme ne peut pas orienter au nom d’une autre structure', async () => {
    const { error } = await memberB.from('referrals').insert(row(f.orgA, `usurpe.${f.tag}@securite.happi.test`));
    expect(error).not.toBeNull();
  });

  it('un participant ne voit aucune orientation, même la sienne', async () => {
    expect((await participantA.from('referrals').select('id')).data).toEqual([]);
    expect((await participantA.from('referral_events').select('id')).data).toEqual([]);
    const { error } = await participantA.from('referrals').insert(row(f.orgA, `x.${f.tag}@securite.happi.test`));
    expect(error).not.toBeNull();
  });

  it('le prescripteur voit seulement l’indication d’un doublon possible', async () => {
    const { data } = await memberA.from('referrals').select('possible_duplicate, participant_id').eq('id', duplicateId).single();
    expect(data).toEqual({ possible_duplicate: true, participant_id: null });
  });

  it('aucune modification directe : statut, consentements et historique passent par les fonctions', async () => {
    const update = await memberA.from('referrals').update({ status: 'accepted' }).eq('id', referralId);
    expect(update.error).not.toBeNull();
    const event = await memberA.from('referral_events').insert({ referral_id: referralId, kind: 'status', source: 'staff' });
    expect(event.error).not.toBeNull();
    const deletion = await memberA.from('referrals').delete().eq('id', referralId).select('id');
    expect(deletion.data ?? []).toEqual([]);
  });

  it('le prescripteur ne peut pas changer le statut ; un autre organisme ne peut pas annuler', async () => {
    expect((await memberA.rpc('set_referral_status', { p_referral_id: referralId, p_status: 'received' })).error?.code).toBe('42501');
    expect((await memberB.rpc('cancel_referral', { p_referral_id: referralId, p_reason: 'Pas à moi' })).error?.code).toBe('42501');
    expect((await participantA.rpc('set_referral_status', { p_referral_id: referralId, p_status: 'received' })).error?.code).toBe('42501');
  });
});

describe('traitement par l’équipe HAPPI', () => {
  it('la capacité d’un groupe est réservée à l’administrateur', async () => {
    const { error } = await trainerA.from('groups').update({ capacity: 3 }).eq('id', f.groupA);
    expect(error).not.toBeNull();
  });

  it('un formateur traite l’orientation ; un formateur d’un autre groupe ne peut pas l’y affecter', async () => {
    expect((await trainerA.rpc('set_referral_status', { p_referral_id: referralId, p_status: 'waitlisted' })).error).toBeNull();
    const denied = await trainerB.rpc('assign_referral_to_group', { p_referral_id: referralId, p_group_id: f.groupA });
    expect(denied.error?.code).toBe('42501');
  });

  it('un formateur ne peut pas s’ouvrir une fiche suivie par une autre équipe via une orientation', async () => {
    const { error } = await trainerB.rpc('assign_referral_to_group', { p_referral_id: duplicateId, p_group_id: f.groupB });
    expect(error?.code).toBe('42501');
    expect((await trainerB.from('participants').select('id').eq('id', f.participantA)).data).toEqual([]);
  });

  it('l’affectation crée la fiche invitée, la rattache au prescripteur et prévient le conseiller', async () => {
    const { data, error } = await trainerA.rpc('assign_referral_to_group', { p_referral_id: referralId, p_group_id: f.groupA });
    expect(error).toBeNull();
    const result = data as { participant_id: string; created: boolean; attached_to_prescriber: boolean };
    createdParticipants.push(result.participant_id);
    expect(result.created).toBe(true);
    expect(result.attached_to_prescriber).toBe(true);
    const { data: participant } = await service.from('participants').select('status, organization_id').eq('id', result.participant_id).single();
    expect(participant).toEqual({ status: 'invited', organization_id: f.orgA });
    const { data: notifications } = await service.from('notifications').select('type').eq('user_id', f.accounts.memberA.id).eq('type', 'referral.status');
    expect((notifications ?? []).length).toBeGreaterThanOrEqual(2);
    // Une décision est définitive.
    expect((await memberA.rpc('cancel_referral', { p_referral_id: referralId, p_reason: 'Trop tard' })).error).not.toBeNull();
  });
});

describe('consentements de la personne', () => {
  it('seule la personne concernée confirme ses consentements, et chaque choix est historisé', async () => {
    // Affectation de l'orientation « doublon » (participant A) par le formateur A, qui suit déjà cette personne.
    const assigned = await trainerA.rpc('assign_referral_to_group', { p_referral_id: duplicateId, p_group_id: f.groupA });
    expect(assigned.error).toBeNull();
    expect((await memberB.rpc('confirm_referral_consents', { p_referral_id: duplicateId, p_image: true, p_share_results: true })).error).not.toBeNull();
    const mine = await participantA.rpc('my_referral_consents');
    expect((mine.data ?? []).map((item) => item.referral_id)).toContain(duplicateId);
    expect((await participantA.rpc('confirm_referral_consents', { p_referral_id: duplicateId, p_image: true, p_share_results: false })).error).toBeNull();
    const { data: events } = await memberA.from('referral_events').select('consent_kind, consent_value, source').eq('referral_id', duplicateId).eq('source', 'participant');
    expect(events).toEqual(
      expect.arrayContaining([
        { consent_kind: 'image', consent_value: true, source: 'participant' },
        { consent_kind: 'share_results', consent_value: false, source: 'participant' },
      ]),
    );
    // Partage refusé : la fiche n'est plus rattachée au prescripteur.
    const { data: participant } = await service.from('participants').select('organization_id').eq('id', f.participantA).single();
    expect(participant?.organization_id).toBeNull();
  });
});
