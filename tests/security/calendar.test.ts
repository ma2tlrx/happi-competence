/**
 * Calendrier des sessions : chaque rôle ne voit que son périmètre, éprouvé avec de vraies sessions
 * utilisateur (RLS) et avec le chargeur du calendrier (src/lib/calendar/queries.ts).
 *
 *   npm run db:start && npm run test:security -- calendar
 */
import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadCalendar, type CalendarSpace } from '@/lib/calendar/queries';
import type { ServerClient } from '@/lib/supabase/server';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

const FROM = '2026-01-01';
const TO = '2026-12-31';
const password = `Cal-${randomBytes(12).toString('base64url')}9`;
let f: Fixtures;
let trainerA: Client;
let trainerB: Client;
let memberA: Client;
let memberB: Client;
let participantA: Client;
let participantB: Client;
let admin: Client;
let adminId: string;
let demoGroup: string;
let sessionA2: string;
let sessionB2: string;
let sessionDemo: string;

const ids = (rows: { id: string }[] | null) => (rows ?? []).map((row) => row.id).sort();
const load = (client: Client, space: CalendarSpace, groupIds?: string[]) => loadCalendar(client as unknown as ServerClient, { space, from: FROM, to: TO, groupIds });

beforeAll(async () => {
  f = await createFixtures();
  const outline = await service.from('program_sessions').select('id, program_id').eq('number', 2);
  const program = await service.from('groups').select('program_id').eq('id', f.groupA).single();
  const second = (outline.data ?? []).find((row) => row.program_id === program.data!.program_id)!;
  const inserted = await service
    .from('sessions')
    .insert([
      { group_id: f.groupA, program_session_id: second.id, number: 2, status: 'planned', scheduled_date: '2026-11-24', start_time: '09:00', end_time: '12:00', location: 'Salle A' },
      { group_id: f.groupB, program_session_id: second.id, number: 2, status: 'planned', scheduled_date: '2026-11-24', start_time: '09:00', end_time: '12:00', location: 'Salle B' },
    ])
    .select('id, group_id');
  sessionA2 = inserted.data!.find((row) => row.group_id === f.groupA)!.id;
  sessionB2 = inserted.data!.find((row) => row.group_id === f.groupB)!.id;

  // Groupe de démonstration, sans lien avec les comptes réels : ne doit apparaître chez aucun d'eux.
  const demo = await service.from('groups').insert({ name: `Groupe démo calendrier ${f.tag}`, program_id: program.data!.program_id, is_demo: true }).select('id').single();
  demoGroup = demo.data!.id;
  const demoSession = await service.from('sessions').insert({ group_id: demoGroup, program_session_id: second.id, number: 2, status: 'planned', scheduled_date: '2026-11-25' }).select('id').single();
  sessionDemo = demoSession.data!.id;

  const created = await service.auth.admin.createUser({ email: `admin.${f.tag}@securite.happi.test`, password, email_confirm: true, user_metadata: { account_type: 'pro', first_name: 'Admin', last_name: 'Calendrier' } });
  adminId = created.data.user!.id;
  await service.from('profiles').update({ role: 'admin' }).eq('id', adminId);
  const client = anonymous();
  await client.auth.signInWithPassword({ email: created.data.user!.email!, password });
  admin = client;

  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  memberA = await signIn(f.accounts.memberA.email);
  memberB = await signIn(f.accounts.memberB.email);
  participantA = await signIn(f.accounts.participantA.email);
  participantB = await signIn(f.accounts.participantB.email);
});

afterAll(async () => {
  await service.from('groups').delete().eq('id', demoGroup);
  if (adminId) await service.auth.admin.deleteUser(adminId);
  await destroyFixtures(f);
});

describe('calendrier : chaque rôle ne voit que son périmètre', () => {
  it('le formateur A voit les sessions de son groupe, pas celles du formateur B ni la démonstration', async () => {
    const rows = await trainerA.from('sessions').select('id').gte('scheduled_date', FROM).lte('scheduled_date', TO);
    expect(ids(rows.data)).toEqual([f.sessionA, sessionA2].sort());
    const other = await trainerA.from('sessions').select('id').in('id', [f.sessionB, sessionB2, sessionDemo]);
    expect(other.data).toEqual([]);
  });

  it('le formateur B ne voit pas celles du formateur A', async () => {
    const rows = await trainerB.from('sessions').select('id').in('id', [f.sessionA, sessionA2]);
    expect(rows.data).toEqual([]);
    expect(ids((await trainerB.from('sessions').select('id').gte('scheduled_date', FROM)).data)).toEqual([f.sessionB, sessionB2].sort());
  });

  it('l’organisme A ne voit que les sessions des groupes de sa structure', async () => {
    const rows = await memberA.from('sessions').select('id').gte('scheduled_date', FROM).lte('scheduled_date', TO);
    expect(ids(rows.data)).toEqual([f.sessionA, sessionA2].sort());
    expect((await memberA.from('sessions').select('id').in('id', [f.sessionB, sessionB2, sessionDemo])).data).toEqual([]);
    expect(ids((await memberB.from('sessions').select('id').gte('scheduled_date', FROM)).data)).toEqual([f.sessionB, sessionB2].sort());
  });

  it('le participant ne voit que les sessions de ses groupes (jamais celles d’un autre ni de la démonstration)', async () => {
    expect(ids((await participantA.from('sessions').select('id').gte('scheduled_date', FROM)).data)).toEqual([f.sessionA, sessionA2].sort());
    expect((await participantA.from('sessions').select('id').in('id', [f.sessionB, sessionB2, sessionDemo])).data).toEqual([]);
    expect(ids((await participantB.from('sessions').select('id').gte('scheduled_date', FROM)).data)).toEqual([f.sessionB, sessionB2].sort());
  });

  it('l’administrateur voit toutes les sessions (organismes, formateurs, démonstration comprise)', async () => {
    const rows = await admin.from('sessions').select('id').in('id', [f.sessionA, sessionA2, f.sessionB, sessionB2, sessionDemo]);
    expect(ids(rows.data)).toEqual([f.sessionA, sessionA2, f.sessionB, sessionB2, sessionDemo].sort());
  });

  it('un visiteur anonyme ne voit aucune session', async () => {
    const rows = await anonymous().from('sessions').select('id').in('id', [f.sessionA, f.sessionB]);
    expect(rows.data ?? []).toEqual([]);
  });
});

describe('chargeur du calendrier (une requête par plage, client de l’appelant)', () => {
  it('formateur : ses groupes uniquement, avec les liens de son espace', async () => {
    const data = await load(trainerA, 'formateur', [f.groupA]);
    expect(data.events.map((event) => event.id).sort()).toEqual([f.sessionA, sessionA2].sort());
    expect(data.events.every((event) => event.href.startsWith('/formateur/sessions/'))).toBe(true);
    expect(data.groups.map((group) => group.value)).toEqual([f.groupA]);
    // Même en demandant les groupes d'un autre formateur, la RLS ne renvoie rien.
    const forged = await load(trainerA, 'formateur', [f.groupB]);
    expect(forged.events).toEqual([]);
  });

  it('organisme : lien vers la page du groupe ; participant : lien vers son parcours', async () => {
    const org = await load(memberA, 'organisme');
    expect(org.events.map((event) => event.id).sort()).toEqual([f.sessionA, sessionA2].sort());
    expect(org.events.every((event) => event.href === `/organisme/groupes/${f.groupA}`)).toBe(true);
    const person = await load(participantA, 'participant');
    expect(person.events.map((event) => event.id).sort()).toEqual([f.sessionA, sessionA2].sort());
    expect(person.events.every((event) => event.href === '/participant/parcours')).toBe(true);
  });

  it('administrateur : tout, et les filtres organisme / formateur / groupe / statut réduisent', async () => {
    const all = await load(admin, 'admin');
    const mine = new Set([f.sessionA, sessionA2, f.sessionB, sessionB2, sessionDemo]);
    expect(all.events.filter((event) => mine.has(event.id))).toHaveLength(5);
    const byOrg = await loadCalendar(admin as unknown as ServerClient, { space: 'admin', from: FROM, to: TO, filters: { organisme: f.orgA } });
    expect(byOrg.events.map((event) => event.id).sort()).toEqual([f.sessionA, sessionA2].sort());
    const byTrainer = await loadCalendar(admin as unknown as ServerClient, { space: 'admin', from: FROM, to: TO, filters: { formateur: f.accounts.trainerB.id } });
    expect(byTrainer.events.map((event) => event.id).sort()).toEqual([f.sessionB, sessionB2].sort());
    const byGroup = await loadCalendar(admin as unknown as ServerClient, { space: 'admin', from: FROM, to: TO, filters: { groupe: f.groupB } });
    expect(byGroup.events.map((event) => event.id).sort()).toEqual([f.sessionB, sessionB2].sort());
    const done = await loadCalendar(admin as unknown as ServerClient, { space: 'admin', from: FROM, to: TO, filters: { organisme: f.orgA, statut: 'completed' }, now: new Date('2026-11-30T10:00:00Z') });
    expect(done.events.map((event) => event.id).sort()).toEqual([f.sessionA, sessionA2].sort());
    const upcoming = await loadCalendar(admin as unknown as ServerClient, { space: 'admin', from: FROM, to: TO, filters: { organisme: f.orgA, statut: 'upcoming' }, now: new Date('2026-11-20T10:00:00Z') });
    expect(upcoming.events.map((event) => event.id)).toEqual([sessionA2]);
  });

  it('ne lit que la plage demandée', async () => {
    const data = await loadCalendar(admin as unknown as ServerClient, { space: 'admin', from: '2026-11-23', to: '2026-11-29', filters: { organisme: f.orgA } });
    expect(data.events.map((event) => event.id)).toEqual([sessionA2]);
    expect(data.events[0]).toMatchObject({ startTime: '09:00', endTime: '12:00', location: 'Salle A', number: 2 });
  });
});
