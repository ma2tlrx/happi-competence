import { describe, expect, it } from 'vitest';

import { AI_WRITING_MENTION, MANUAL_WRITING_MENTION, writingMention } from './ai-disclosure';
import { buildDossier } from './prompt';
import { REDACTED, redactPersonalData } from './redact';

describe('masquage des données personnelles avant envoi à l’IA', () => {
  it('masque les adresses e-mail', () => {
    expect(redactPersonalData('Écrire à jean.dupont+test@exemple.fr pour le suivi.')).toBe(`Écrire à ${REDACTED.email} pour le suivi.`);
  });

  it('masque les téléphones français et internationaux', () => {
    for (const phone of ['06 12 34 56 78', '0612345678', '06.12.34.56.78', '+33 6 12 34 56 78', '+33612345678', '0033 6 12 34 56 78', '+44 20 7946 0958']) {
      expect(redactPersonalData(`Joignable au ${phone}.`)).toBe(`Joignable au ${REDACTED.phone}.`);
    }
  });

  it('masque le numéro de sécurité sociale et les longs identifiants', () => {
    expect(redactPersonalData('NIR 1 85 05 78 006 084 36')).not.toMatch(/\d{3}/);
    expect(redactPersonalData('Sécu : 185057800608436.')).toBe(`Sécu : ${REDACTED.number}.`);
    expect(redactPersonalData('Corse : 2 90 02 2A 123 456 78')).toContain(REDACTED.number);
    expect(redactPersonalData('IBAN FR76 3000 6000 0112 3456 7890 189')).toContain(REDACTED.number);
  });

  it('masque un identifiant introduit par un mot-clé', () => {
    expect(redactPersonalData('Identifiant France Travail : 1234567A.')).toBe(`Identifiant France Travail : ${REDACTED.number}.`);
    expect(redactPersonalData('n° de dossier 2024-AB-778')).toContain(REDACTED.number);
  });

  it('masque les adresses postales', () => {
    expect(redactPersonalData('Habite 12 rue des Lilas, près de la gare.')).toBe(`Habite ${REDACTED.address}, près de la gare.`);
    expect(redactPersonalData('Domicile : 3 bis avenue Foch')).toBe(`Domicile : ${REDACTED.address}`);
    expect(redactPersonalData('Déménage à 34000 Montpellier.')).toBe(`Déménage à ${REDACTED.address}.`);
    expect(redactPersonalData('Courrier en BP 45')).toBe(`Courrier en ${REDACTED.address}`);
  });

  it('masque le prénom et le nom de la personne', () => {
    expect(redactPersonalData('Léa a guidé son équipe ; MARTIN reste discrète.', { names: ['Léa', 'Martin'] })).toBe(
      `${REDACTED.name} a guidé son équipe ; ${REDACTED.name} reste discrète.`,
    );
    // Mot entier uniquement.
    expect(redactPersonalData('Une session marquante.', { names: ['Marc'] })).toBe('Une session marquante.');
  });

  it('ne touche pas aux commentaires pédagogiques ordinaires', () => {
    const text = 'Lors de la session 2, a proposé 3 stratégies en 15 minutes et a aidé 4 coéquipiers. Progression nette depuis le 12/03/2026. Les 2 cours suivants : dossier complet.';
    expect(redactPersonalData(text)).toBe(text);
  });

  it('conserve les valeurs vides telles quelles', () => {
    expect(redactPersonalData(null)).toBeNull();
    expect(redactPersonalData('')).toBe('');
    expect(redactPersonalData(undefined)).toBeUndefined();
  });

  it('s’applique au dossier sans en changer la structure', () => {
    const data = {
      program: null,
      sufficiency: 'ok',
      missing: [],
      sessions: [],
      participant: { firstName: 'Léa', lastName: 'Martin' },
      frameworks: [
        {
          code: 'transversal', name: 'CT', isProvisional: true, levels: [], rules: { aggregationLabel: 'x' }, shape: 'x',
          highlights: { strengths: [], toDevelop: [], progressions: [], insufficient: [] }, categories: [],
          skills: [{ code: 'a', name: 'A', description: '', categoryName: '', status: 'single', levelLabel: 'Acquis', levelDescriptor: '', trend: null, self: null,
            observations: [{ session: 1, levelLabel: 'Acquis', comment: 'Léa a donné son 06 12 34 56 78.' }] }],
        },
      ],
      feedback: [{ session: 1, title: 'S1', date: null, observation: 'Écrire à lea@exemple.fr', advice: null }],
      selfAssessment: { completedAt: null, comment: 'J’habite 4 rue Haute' },
    } as unknown as Parameters<typeof buildDossier>[0];
    const dossier = buildDossier(data, { extraObservations: 'Sécu 185057800608436' } as Parameters<typeof buildDossier>[1]);
    const json = JSON.stringify(dossier);
    expect(json).not.toMatch(/Léa|06 12|lea@|rue Haute|185057800608436/);
    expect(dossier.referentiels[0]!.competences[0]!.observations[0]!.commentaire_formateur).toBe(`${REDACTED.name} a donné son ${REDACTED.phone}.`);
    expect(dossier.commentaires_de_session[0]).toEqual({ session: 1, observation: `Écrire à ${REDACTED.email}`, conseil: null });
    expect(Object.keys(dossier)).toEqual([
      'programme', 'suffisance_des_donnees', 'donnees_manquantes', 'sessions', 'referentiels', 'commentaires_de_session', 'auto_evaluation_initiale',
      'observations_complementaires_du_formateur',
    ]);
  });
});

describe('mention de l’usage de l’IA (art. 50)', () => {
  it('dépend de l’origine du texte', () => {
    expect(writingMention('ai')).toBe(AI_WRITING_MENTION);
    expect(writingMention('ai_edited')).toBe(AI_WRITING_MENTION);
    expect(writingMention('manual')).toBe(MANUAL_WRITING_MENTION);
    expect(writingMention(null)).toBeNull();
    expect(AI_WRITING_MENTION).toBe('Texte rédigé avec l’aide d’une intelligence artificielle, relu et validé par le formateur');
  });
});
