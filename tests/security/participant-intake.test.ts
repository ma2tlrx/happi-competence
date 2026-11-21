/**
 * Questionnaire d'accueil (participant_intakes) : écrit par la personne seule ; lu par elle, ses formateurs et
 * l'administration ; jamais par l'organisme, un autre participant, un formateur qui ne la suit pas, ni un anonyme.
 * Codes contrôlés par la base ; journal sans les réponses.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonymous, createFixtures, destroyFixtures, service, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let participantA: Client;
let participantB: Client;
let trainerA: Client;
let trainerB: Client;
let organisme: Client;
let admin: Client;

const answersA = { age_band: '18_21', situation: 'demandeur_emploi', residence: 'beziers', study_level: 'bac_pro', last_step: 2 };

beforeAll(async () => {
  f = await createFixtures();
  participantA = await signIn(f.accounts.participantA.email);
  participantB = await signIn(f.accounts.participantB.email);
  trainerA = f.clients.trainerA;
  trainerB = f.clients.trainerB;
  organisme = await signIn(f.accounts.memberA.email); // structure de la fiche A
  await service.from('profiles').update({ role: 'admin' }).eq('id', f.accounts.memberB.id);
  admin = await signIn(f.accounts.memberB.email);
});

afterAll(async () => {
  const ids = [f.participantA, f.participantB];
  await destroyFixtures(f);
  // Cascade : plus aucune réponse une fois les fiches supprimées.
  const { count } = await service.from('participant_intakes').select('participant_id', { count: 'exact', head: true }).in('participant_id', ids);
  expect(count).toBe(0);
});

describe('questionnaire d’accueil', () => {
  it('la personne écrit et relit sa propre ligne', async () => {
    const inserted = await participantA.from('participant_intakes').insert({ participant_id: f.participantA, ...answersA });
    expect(inserted.error).toBeNull();
    const updated = await participantA.from('participant_intakes').update({ two_year_plan: 'emploi', last_step: 4 }).eq('participant_id', f.participantA).select('two_year_plan');
    expect(updated.error).toBeNull();
    expect(updated.data).toEqual([{ two_year_plan: 'emploi' }]);
    const read = await participantA.from('participant_intakes').select('participant_id, age_band').eq('participant_id', f.participantA);
    expect(read.data).toEqual([{ participant_id: f.participantA, age_band: '18_21' }]);
  });

  it('un autre participant ne lit ni n’écrit la ligne de quelqu’un d’autre', async () => {
    const read = await participantB.from('participant_intakes').select('participant_id').eq('participant_id', f.participantA);
    expect(read.data).toEqual([]);
    const forged = await participantB.from('participant_intakes').insert({ participant_id: f.participantA, age_band: '25_plus' });
    expect(forged.error).not.toBeNull();
    const own = await participantB.from('participant_intakes').insert({ participant_id: f.participantB, age_band: '22_24' });
    expect(own.error).toBeNull();
    const tamper = await participantB.from('participant_intakes').update({ age_band: '15_17' }).eq('participant_id', f.participantA).select('participant_id');
    expect(tamper.data ?? []).toEqual([]);
  });

  it('le formateur de la personne lit, sans pouvoir écrire ; un autre formateur ne lit rien', async () => {
    const read = await trainerA.from('participant_intakes').select('participant_id, situation').eq('participant_id', f.participantA);
    expect(read.data).toEqual([{ participant_id: f.participantA, situation: 'demandeur_emploi' }]);
    const write = await trainerA.from('participant_intakes').update({ situation: 'salarie' }).eq('participant_id', f.participantA).select('participant_id');
    expect(write.data ?? []).toEqual([]);
    const other = await trainerB.from('participant_intakes').select('participant_id').eq('participant_id', f.participantA);
    expect(other.data).toEqual([]);
  });

  it('l’organisme de rattachement et les anonymes n’y ont pas accès ; l’administration lit', async () => {
    expect((await organisme.from('participant_intakes').select('participant_id').eq('participant_id', f.participantA)).data).toEqual([]);
    expect((await anonymous().from('participant_intakes').select('participant_id')).data ?? []).toEqual([]);
    const read = await admin.from('participant_intakes').select('participant_id').in('participant_id', [f.participantA, f.participantB]);
    expect((read.data ?? []).map((row) => row.participant_id).sort()).toEqual([f.participantA, f.participantB].sort());
  });

  it('la base refuse un code inconnu et un domaine de bénévolat hors liste', async () => {
    const badAge = await participantA.from('participant_intakes').update({ age_band: '30_54' }).eq('participant_id', f.participantA);
    expect(badAge.error).not.toBeNull();
    const badField = await participantA.from('participant_intakes').update({ volunteering_fields: ['sport_loisirs', 'inconnu'] }).eq('participant_id', f.participantA);
    expect(badField.error).not.toBeNull();
    const badRating = await participantA.from('participant_intakes').update({ aptitude_motivation: 7 }).eq('participant_id', f.participantA);
    expect(badRating.error).not.toBeNull();
  });

  it('le journal note seulement que le questionnaire est rempli, sans les réponses', async () => {
    const done = await participantA
      .from('participant_intakes')
      .update({ ambitions: 'Devenir cuisinier', completed_at: new Date().toISOString(), last_step: 5 })
      .eq('participant_id', f.participantA)
      .select('participant_id');
    expect(done.data?.length).toBe(1);
    const { data: logs } = await service.from('audit_logs').select('action, metadata').eq('participant_id', f.participantA).eq('action', 'participant_intake.completed');
    expect(logs?.length).toBe(1);
    expect(JSON.stringify(logs?.[0]?.metadata ?? {})).not.toContain('cuisinier');
  });

  it('chaque personne a au plus une ligne (la suppression suit la fiche, vérifiée à la fin)', async () => {
    const { count } = await service.from('participant_intakes').select('participant_id', { count: 'exact', head: true }).in('participant_id', [f.participantA, f.participantB]);
    expect(count).toBe(2);
    const duplicate = await participantA.from('participant_intakes').insert({ participant_id: f.participantA, age_band: '22_24' });
    expect(duplicate.error).not.toBeNull();
  });
});
