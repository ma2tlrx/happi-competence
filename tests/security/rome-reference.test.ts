/**
 * Référentiel ROME structuré (pistes métiers) : données publiques en lecture pour les comptes connectés,
 * jamais modifiables par un compte (ni formateur, ni participant), invisibles sans connexion.
 * Suppose le référentiel chargé dans la base locale (scripts/rome/build-reference-sql.py) ; sinon les
 * contrôles de lecture vérifient seulement l'absence d'erreur.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonymous, createFixtures, destroyFixtures, signIn, type Client, type Fixtures } from './fixtures';

let f: Fixtures;
let participant: Client;
let trainer: Client;
let organisme: Client;

beforeAll(async () => {
  f = await createFixtures();
  participant = await signIn(f.accounts.participantA.email);
  trainer = f.clients.trainerA;
  organisme = await signIn(f.accounts.memberA.email);
});

afterAll(async () => {
  await destroyFixtures(f);
});

const TABLES = ['rome_domains', 'rome_fiches', 'rome_fiche_savoir_etre'] as const;

describe('référentiel ROME (pistes métiers)', () => {
  it('lisible par un compte connecté', async () => {
    for (const table of TABLES) {
      const { error } = await trainer.from(table).select('*').limit(1);
      expect(error, table).toBeNull();
    }
  });

  it('invisible sans connexion', async () => {
    for (const table of TABLES) {
      const { data, error } = await anonymous().from(table).select('*').limit(1);
      expect(error !== null || (data ?? []).length === 0, table).toBe(true);
    }
  });

  it('aucun compte ne peut écrire', async () => {
    for (const client of [trainer, participant, organisme]) {
      // Valeur conforme aux contraintes : seul le contrôle d'accès peut la refuser.
      const domain = await client.from('rome_domains').insert({ code: 'A', label: 'Faux domaine' });
      expect(domain.error?.code).toBe('42501');
      const link = await client.from('rome_fiche_savoir_etre').delete().eq('savoir_etre_code', '6D101').select();
      expect(link.error !== null || (link.data ?? []).length === 0).toBe(true);
      const fiche = await client.from('rome_fiches').update({ appellations: ['Piratage'] }).neq('code', '').select();
      expect(fiche.error !== null || (fiche.data ?? []).length === 0).toBe(true);
    }
  });
});
