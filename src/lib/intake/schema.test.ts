import { describe, expect, it } from 'vitest';

import { isIntakeStep, parseStep } from './schema';

describe('questionnaire d’accueil : validation par étape', () => {
  it('étape 1 : âge, situation et ville obligatoires, comme dans l’ancien formulaire', () => {
    const missing = parseStep(1, {});
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.issues.map((issue) => issue.path[0]).sort()).toEqual(['age_band', 'residence', 'situation']);
    const valid = parseStep(1, { age_band: '18_21', situation: 'demandeur_emploi', residence: 'beziers', residence_detail: 'ignoré', phone: '06 12 34 56 78' });
    expect(valid).toMatchObject({ ok: true, columns: { age_band: '18_21', residence: 'beziers', residence_detail: null }, phone: '06 12 34 56 78' });
  });

  it('étape 1 : la précision de ville est gardée pour « Autre ville », le téléphone reste facultatif mais vérifié', () => {
    expect(parseStep(1, { age_band: '22_24', situation: 'salarie', residence: 'autre_ville', residence_detail: '  Sérignan ', phone: '' })).toMatchObject({
      ok: true,
      columns: { residence_detail: 'Sérignan' },
      phone: null,
    });
    expect(parseStep(1, { age_band: '22_24', situation: 'salarie', residence: 'beziers', phone: 'appelle-moi' }).ok).toBe(false);
    expect(parseStep(1, { age_band: '22_24', situation: 'salarie', residence: 'beziers', phone: '+33 6 12 34 56 78' }).ok).toBe(true);
  });

  it('refuse un code qui n’existe pas', () => {
    expect(parseStep(1, { age_band: '30_54', situation: 'salarie', residence: 'beziers' }).ok).toBe(false);
    expect(parseStep(4, { two_year_plan: 'emploi', sectors: ['astronaute'] }).ok).toBe(false);
  });

  it('étape 2 : seul le niveau d’études est obligatoire, les textes sont nettoyés et bornés', () => {
    expect(parseStep(2, { study_level: 'bac_pro', study_field: '  ', school: 'Lycée Jean Moulin' })).toMatchObject({
      ok: true,
      columns: { study_level: 'bac_pro', study_field: null, school: 'Lycée Jean Moulin' },
    });
    expect(parseStep(2, { study_level: 'bac_pro', school: 'x'.repeat(201) }).ok).toBe(false);
  });

  it('étape 3 : pas de domaine de bénévolat sans bénévolat, pas de description sans expérience', () => {
    const result = parseStep(3, { volunteering: 'jamais', volunteering_fields: ['sport_loisirs'], experience: 'aucune', experience_detail: 'Stage' });
    expect(result).toMatchObject({ ok: true, columns: { volunteering_fields: [], experience_detail: null } });
    const kept = parseStep(3, { volunteering: 'ponctuel', volunteering_fields: ['sport_loisirs', 'sport_loisirs', 'culture_art'], experience: 'autre_domaine', experience_detail: 'Serveur, 6 mois' });
    expect(kept).toMatchObject({ ok: true, columns: { volunteering_fields: ['sport_loisirs', 'culture_art'], experience_detail: 'Serveur, 6 mois' } });
  });

  it('étape 4 : le projet à 2 ans est obligatoire, les secteurs non', () => {
    expect(parseStep(4, { sectors: [] }).ok).toBe(false);
    expect(parseStep(4, { two_year_plan: 'ne_sait_pas' })).toMatchObject({ ok: true, columns: { sectors: [], ambitions: null } });
  });

  it('étape 5 : les aptitudes sont facultatives et notées de 1 à 5', () => {
    expect(parseStep(5, {})).toMatchObject({ ok: true, columns: { aptitude_punctuality: null, aptitude_initiative: null } });
    expect(parseStep(5, { aptitude_motivation: 4 })).toMatchObject({ ok: true, columns: { aptitude_motivation: 4 } });
    expect(parseStep(5, { aptitude_motivation: 6 }).ok).toBe(false);
    expect(parseStep(5, { aptitude_motivation: 2.5 }).ok).toBe(false);
  });

  it('ne reconnaît que les étapes 1 à 5', () => {
    expect([0, 1, 5, 6, '1'].map(isIntakeStep)).toEqual([false, true, true, false, false]);
  });
});
