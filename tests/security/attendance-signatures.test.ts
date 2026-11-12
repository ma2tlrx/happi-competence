/**
 * Émargement électronique : qui signe pour qui, quand, et gel de la feuille après la
 * contre-signature du formateur. Séance « du jour » créée pour l'occasion dans chaque groupe.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parisDate } from '@/lib/attendance/signature';

import { createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let trainerA: Client;
let trainerB: Client;
let memberA: Client;
let memberB: Client;
let participantA: Client;
let participantB: Client;
let todayA: string;
let todayB: string;
let participantC: string;

const path = 'M20 120 L60 60 L100 140 L140 70 L180 130 L220 80 M260 100 L300 100';

beforeAll(async () => {
  f = await createFixtures();
  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  memberA = await signIn(f.accounts.memberA.email);
  memberB = await signIn(f.accounts.memberB.email);
  participantA = await signIn(f.accounts.participantA.email);
  participantB = await signIn(f.accounts.participantB.email);

  const { data: program } = await service.from('groups').select('program_id').eq('id', f.groupA).single();
  const { data: outline } = await service.from('program_sessions').select('id, number').eq('program_id', program!.program_id).eq('number', 2).single();
  const { data: sessions, error } = await service
    .from('sessions')
    .insert([
      { group_id: f.groupA, program_session_id: outline!.id, number: 2, status: 'in_progress', scheduled_date: parisDate(), start_time: '09:00', end_time: '12:00' },
      { group_id: f.groupB, program_session_id: outline!.id, number: 2, status: 'in_progress', scheduled_date: parisDate(), start_time: '09:00', end_time: '12:00' },
    ])
    .select('id, group_id');
  if (error) throw new Error(error.message);
  todayA = sessions!.find((row) => row.group_id === f.groupA)!.id;
  todayB = sessions!.find((row) => row.group_id === f.groupB)!.id;
  expect((await trainerA.from('attendance').insert({ session_id: todayA, participant_id: f.participantA, status: 'present' })).error).toBeNull();
  expect((await trainerB.from('attendance').insert({ session_id: todayB, participant_id: f.participantB, status: 'late' })).error).toBeNull();
  // Troisième participant (sans compte) du groupe A, présent mais pas encore signé au moment du gel.
  const { data: extra } = await service.from('participants').insert({ first_name: 'Charlie', last_name: `Sécurité ${f.tag}` }).select('id').single();
  participantC = extra!.id;
  expect((await service.from('group_members').insert({ group_id: f.groupA, participant_id: participantC })).error).toBeNull();
  expect((await trainerA.from('attendance').insert({ session_id: todayA, participant_id: participantC, status: 'present' })).error).toBeNull();
});

afterAll(async () => {
  if (participantC) await service.from('participants').delete().eq('id', participantC);
  await destroyFixtures(f);
});

describe('émargement : signature du participant', () => {
  it('un participant ne signe pas pour un autre', async () => {
    const { error } = await participantA.from('attendance_signatures').insert({ session_id: todayB, participant_id: f.participantB, kind: 'drawn', signature_svg: path });
    expect(error).not.toBeNull();
    const own = await participantA.from('attendance_signatures').insert({ session_id: todayA, participant_id: f.participantB, kind: 'drawn', signature_svg: path });
    expect(own.error).not.toBeNull();
  });

  it('un participant ne peut pas déclarer « signature impossible » lui-même', async () => {
    const { error } = await participantA.from('attendance_signatures').insert({ session_id: todayA, participant_id: f.participantA, kind: 'unable', unable_reason: 'Pas envie' });
    expect(error).not.toBeNull();
  });

  it('un tracé invalide est refusé par la base', async () => {
    const { error } = await participantA.from('attendance_signatures').insert({ session_id: todayA, participant_id: f.participantA, kind: 'drawn', signature_svg: '<svg onload=alert(1)>' });
    expect(error).not.toBeNull();
  });

  it('le participant signe pour lui-même ; la base fixe le mode, l’auteur et l’empreinte', async () => {
    const { error } = await participantA.from('attendance_signatures').insert({ session_id: todayA, participant_id: f.participantA, kind: 'drawn', signature_svg: path });
    expect(error).toBeNull();
    const { data } = await participantA.from('attendance_signatures').select('method, collected_by, content_sha256, attendance_status').eq('session_id', todayA).single();
    expect(data).toMatchObject({ method: 'own_account', collected_by: f.accounts.participantA.id, attendance_status: 'present' });
    expect(data!.content_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('une seule signature par séance, et elle ne se modifie ni ne se supprime', async () => {
    const again = await participantA.from('attendance_signatures').insert({ session_id: todayA, participant_id: f.participantA, kind: 'drawn', signature_svg: path });
    expect(again.error).not.toBeNull();
    await trainerA.from('attendance_signatures').delete().eq('session_id', todayA);
    const update = await service.from('attendance_signatures').update({ signature_svg: path.replace('M20', 'M21') }).eq('session_id', todayA);
    expect(update.error?.message).toMatch(/ne se modifie pas/);
    const { count } = await service.from('attendance_signatures').select('id', { count: 'exact', head: true }).eq('session_id', todayA);
    expect(count).toBe(1);
  });

  it('un participant signé ne peut plus être noté absent', async () => {
    const { error } = await trainerA.from('attendance').update({ status: 'absent' }).eq('session_id', todayA).eq('participant_id', f.participantA);
    expect(error?.message).toMatch(/a signé/);
  });

  it('l’empreinte d’IP n’est pas lisible par les utilisateurs', async () => {
    expect((await trainerA.from('attendance_signatures').select('ip_hmac')).error).not.toBeNull();
  });
});

describe('émargement : lecture et recueil par les professionnels', () => {
  it('un formateur d’un autre groupe ne lit pas les signatures, ni ne signe', async () => {
    expect((await trainerB.from('attendance_signatures').select('id').eq('session_id', todayA)).data).toEqual([]);
    const { error } = await trainerB.from('attendance_signatures').insert({ session_id: todayA, participant_id: f.participantA, kind: 'unable', unable_reason: 'Main blessée' });
    expect(error).not.toBeNull();
  });

  it('l’organisme du participant lit ; un autre organisme non ; un organisme ne signe pas', async () => {
    expect((await memberA.from('attendance_signatures').select('id').eq('session_id', todayA)).data).toHaveLength(1);
    expect((await memberB.from('attendance_signatures').select('id').eq('session_id', todayA)).data).toEqual([]);
    const { error } = await memberB.from('attendance_signatures').insert({ session_id: todayB, participant_id: f.participantB, kind: 'drawn', signature_svg: path });
    expect(error).not.toBeNull();
  });

  it('le formateur du groupe recueille une mention « signature impossible » sur sa tablette', async () => {
    const { error } = await trainerB.from('attendance_signatures').insert({ session_id: todayB, participant_id: f.participantB, kind: 'unable', unable_reason: 'Main blessée' });
    expect(error).toBeNull();
    const { data } = await participantB.from('attendance_signatures').select('method, kind, collected_by').eq('session_id', todayB).single();
    expect(data).toMatchObject({ method: 'trainer_device', kind: 'unable', collected_by: f.accounts.trainerB.id });
  });

  it('une séance passée ne s’émarge plus', async () => {
    const { error } = await trainerA.from('attendance_signatures').insert({ session_id: f.sessionA, participant_id: f.participantA, kind: 'drawn', signature_svg: path });
    expect(error).not.toBeNull();
  });
});

describe('émargement : contre-signature et gel', () => {
  it('un formateur d’un autre groupe ne contre-signe pas', async () => {
    expect((await trainerB.from('attendance_countersignatures').insert({ session_id: todayA, signature_svg: path })).error).not.toBeNull();
  });

  it('le formateur du groupe contre-signe ; la base fige la liste attestée', async () => {
    expect((await trainerA.from('attendance_countersignatures').insert({ session_id: todayA, signature_svg: path })).error).toBeNull();
    const { data } = await trainerA.from('attendance_countersignatures').select('trainer_id, attested, signatures_sha256').eq('session_id', todayA).single();
    expect(data!.trainer_id).toBe(f.accounts.trainerA.id);
    expect(data!.attested).toHaveLength(2);
    expect((await memberB.from('attendance_countersignatures').select('session_id').eq('session_id', todayA)).data).toEqual([]);
  });

  it('après contre-signature : plus de signature ni de changement de présence', async () => {
    const late = await trainerA.from('attendance').update({ status: 'late' }).eq('session_id', todayA).eq('participant_id', f.participantA);
    expect(late.error?.message).toMatch(/contre-signée/);
    // Charlie était présent et n'avait pas signé : le formateur du groupe ne peut plus le faire signer.
    const sign = await trainerA.from('attendance_signatures').insert({ session_id: todayA, participant_id: participantC, kind: 'unable', unable_reason: 'Main blessée' });
    expect(sign.error).not.toBeNull();
    const { data } = await participantA.rpc('my_attendance_signing');
    expect(data?.find((row) => row.session_id === todayA)).toMatchObject({ frozen: true, can_sign: false });
  });

  it('seul un administrateur corrige une présence figée (correction tracée)', async () => {
    const { error } = await trainerA.rpc('correct_attendance', { p_session_id: todayA, p_participant_id: f.participantA, p_status: 'late', p_reason: 'Arrivée constatée à 9 h 40' });
    expect(error).not.toBeNull();
    const { data } = await service.from('attendance').select('status').eq('session_id', todayA).eq('participant_id', f.participantA).single();
    expect(data!.status).toBe('present');
  });
});
