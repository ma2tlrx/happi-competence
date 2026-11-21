/**
 * Relance d'une personne absente (public.relaunch_absent_participant, table absence_followups) :
 * seul un organisme actif relance une personne de sa structure, inscrite dans le groupe, absente sans
 * justificatif à sa dernière séance terminée, une seule fois. Aucune écriture directe dans la table ;
 * lecture par la structure, les formateurs du participant et l'administration seulement.
 *
 * Séances du groupe A : 1 (terminée, fixtures), 2 (terminée), 3 (prévue).
 *   participant A : présent en 1, absent en 2          → relance acceptée (une fois)
 *   Excusée       : absence justifiée en 2              → refus
 *   Revenu        : absent en 1, présent en 2           → refus (séance plus récente)
 *   Partie        : absente en 2 puis abandon           → refus (parcours interrompu)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let memberA: Client;
let memberB: Client;
let trainerA: Client;
let trainerB: Client;
let participantA: Client;
let session2: string;
let session3: string;
/** Relance acceptée par le premier test (les blocs s'exécutent dans l'ordre du fichier). */
let followupId = '';
const extra: Record<'excused' | 'back' | 'left', string> = { excused: '', back: '', left: '' };

const relaunch = (client: Client, sessionId: string, participantId: string) =>
  client.rpc('relaunch_absent_participant', { p_session_id: sessionId, p_participant_id: participantId });

function must<R extends { data: unknown; error: { message: string } | null }>(result: R, label: string): NonNullable<R['data']> {
  if (result.error) throw new Error(`${label} : ${result.error.message}`);
  return result.data as NonNullable<R['data']>;
}

beforeAll(async () => {
  f = await createFixtures();
  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  [memberA, memberB, participantA] = await Promise.all([signIn(f.accounts.memberA.email), signIn(f.accounts.memberB.email), signIn(f.accounts.participantA.email)]);

  const { data: group } = await service.from('groups').select('program_id').eq('id', f.groupA).single();
  const outline = must(await service.from('program_sessions').select('id, number').eq('program_id', group!.program_id).in('number', [2, 3]).order('number'), 'trame');
  const [s2, s3] = must(
    await service
      .from('sessions')
      .insert([
        { group_id: f.groupA, program_session_id: outline[0]!.id, number: 2, status: 'completed', scheduled_date: '2026-01-17' },
        { group_id: f.groupA, program_session_id: outline[1]!.id, number: 3, status: 'planned', scheduled_date: '2999-01-24' },
      ])
      .select('id')
      .order('number'),
    'séances',
  );
  session2 = s2!.id;
  session3 = s3!.id;

  // Trois autres personnes de la structure A, inscrites dans le groupe A (fiches sans compte).
  const people = must(
    await service
      .from('participants')
      .insert(
        (['excused', 'back', 'left'] as const).map((name) => ({
          first_name: name,
          last_name: `Relance ${f.tag}`,
          email: `${name}.${f.tag}@securite.happi.test`,
          organization_id: f.orgA,
        })),
      )
      .select('id, first_name'),
    'fiches',
  );
  for (const person of people) extra[person.first_name as keyof typeof extra] = person.id;
  must(await service.from('group_members').insert(people.map((person) => ({ group_id: f.groupA, participant_id: person.id }))), 'inscriptions');

  // Présences saisies par le formateur du groupe, avec sa propre session.
  must(
    await trainerA.from('attendance').insert([
      { session_id: session2, participant_id: f.participantA, status: 'absent' },
      { session_id: session2, participant_id: extra.excused, status: 'excused' },
      { session_id: f.sessionA, participant_id: extra.back, status: 'absent' },
      { session_id: session2, participant_id: extra.back, status: 'present' },
      { session_id: session2, participant_id: extra.left, status: 'absent' },
    ]),
    'présences',
  );
  must(
    await trainerA.from('group_members').update({ status: 'dropped', drop_reason: 'sans_nouvelles', dropped_at: '2026-01-20' }).eq('group_id', f.groupA).eq('participant_id', extra.left),
    'abandon',
  );
});

afterAll(async () => {
  await service.from('profiles').update({ role: 'formateur' }).eq('id', f.accounts.trainerB.id);
  if (f) await service.from('participants').delete().in('id', Object.values(extra).filter(Boolean));
  await destroyFixtures(f);
});

describe('relance d’une personne absente', () => {
  it('l’organisme relance une personne de sa structure, absente sans justificatif à sa dernière séance', async () => {
    const { data, error } = await relaunch(memberA, session2, f.participantA);
    expect(error).toBeNull();
    expect(data).toMatch(/^[0-9a-f-]{36}$/);
    followupId = data!;
  });

  it('pas de second envoi pour la même absence', async () => {
    const { error } = await relaunch(memberA, session2, f.participantA);
    expect(error?.message).toBe('Cette personne a déjà été relancée pour cette absence.');
    expect((await service.from('absence_followups').select('id').eq('participant_id', f.participantA)).data).toHaveLength(1);
  });

  it('refuse une personne présente, une absence justifiée, une séance non terminée', async () => {
    expect((await relaunch(memberA, f.sessionA, f.participantA)).error?.message).toBe('Cette personne n’est pas notée absente à cette séance.');
    expect((await relaunch(memberA, session2, extra.excused)).error?.message).toBe('Absence justifiée : pas de relance.');
    expect((await relaunch(memberA, session3, f.participantA)).error?.message).toBe('Cette séance n’est pas terminée : la relance n’est pas encore possible.');
  });

  it('refuse une absence suivie d’une séance plus récente, et un parcours interrompu', async () => {
    expect((await relaunch(memberA, f.sessionA, extra.back)).error?.message).toBe(
      'Une séance plus récente a eu lieu depuis : seule la dernière absence peut être relancée.',
    );
    expect((await relaunch(memberA, session2, extra.left)).error?.message).toBe('Parcours interrompu : pas de relance.');
  });

  it('refuse une personne d’une autre structure, sans rien révéler de sa séance', async () => {
    const { error } = await relaunch(memberB, session2, f.participantA);
    expect(error?.message).toBe('Cette personne n’est pas suivie par votre structure.');
    expect((await relaunch(memberA, f.sessionB, f.participantB)).error?.message).toBe('Cette personne n’est pas suivie par votre structure.');
  });

  it('refuse une séance d’un autre groupe que celui de la personne', async () => {
    expect((await relaunch(memberA, f.sessionB, f.participantA)).error?.message).toBe('Cette personne n’est pas inscrite dans le groupe de cette séance.');
  });

  it('refuse un participant, un formateur et un visiteur anonyme', async () => {
    expect((await relaunch(participantA, session2, extra.excused)).error?.message).toBe('Seul un compte organisme peut relancer une personne absente.');
    expect((await relaunch(trainerA, session2, extra.excused)).error?.message).toBe('Seul un compte organisme peut relancer une personne absente.');
    const anon = await relaunch(anonymous(), session2, extra.excused);
    expect(anon.error).not.toBeNull();
    expect(anon.data).toBeNull();
  });

  it('aucune écriture directe dans la table, même par la structure', async () => {
    const insert = await memberA.from('absence_followups').insert({ session_id: session2, participant_id: extra.excused, organization_id: f.orgA });
    expect(insert.error).not.toBeNull();
    const update = await memberA.from('absence_followups').update({ created_at: new Date().toISOString() }).eq('id', followupId).select('id');
    expect(update.error !== null || (update.data ?? []).length === 0).toBe(true);
    const remove = await memberA.from('absence_followups').delete().eq('id', followupId).select('id');
    expect(remove.error !== null || (remove.data ?? []).length === 0).toBe(true);
    expect((await trainerA.from('absence_followups').insert({ session_id: session2, participant_id: extra.excused, organization_id: f.orgA })).error).not.toBeNull();
    expect((await service.from('absence_followups').select('id').eq('id', followupId)).data).toHaveLength(1);
  });

  it('chaque relance est tracée dans le journal, identifiants seulement', async () => {
    const { data } = await service.from('audit_logs').select('action, entity_type, entity_id, organization_id, metadata').eq('participant_id', f.participantA).eq('action', 'absence_followup.sent');
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ entity_type: 'session', entity_id: session2, organization_id: f.orgA, metadata: { followup_id: followupId } });
  });
});

describe('lecture des relances', () => {
  it('la structure qui a relancé et les formateurs du participant les lisent', async () => {
    expect((await memberA.from('absence_followups').select('id, session_id, participant_id').eq('id', followupId)).data).toHaveLength(1);
    expect((await trainerA.from('absence_followups').select('id').eq('participant_id', f.participantA)).data).toHaveLength(1);
  });

  it('une autre structure, un autre formateur et le participant ne lisent rien', async () => {
    expect((await memberB.from('absence_followups').select('id')).data).toEqual([]);
    expect((await trainerB.from('absence_followups').select('id')).data).toEqual([]);
    expect((await participantA.from('absence_followups').select('id')).data).toEqual([]);
    expect((await anonymous().from('absence_followups').select('id')).data ?? []).toEqual([]);
  });

  it('l’administration les lit', async () => {
    // Administrateur temporaire : le formateur B promu le temps du test (rétabli en fin de fichier).
    await service.from('profiles').update({ role: 'admin' }).eq('id', f.accounts.trainerB.id);
    const admin = await signIn(f.accounts.trainerB.email);
    expect((await admin.from('absence_followups').select('id').eq('participant_id', f.participantA)).data).toHaveLength(1);
  });
});
