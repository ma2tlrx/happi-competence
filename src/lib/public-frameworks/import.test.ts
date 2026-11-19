import { describe, expect, it } from 'vitest';

import { detectDelimiter, extractExternalSkills, jsonToRecords, labelMatch, normalizeLabel, parseCsv, proposeLabelMatches, toRecords } from './import';

// Données FICTIVES : aucun libellé ni code officiel n'est reproduit ici.
const CSV = '﻿identifiant;intitule;texte;type\r\nF1;Force de proposition;Déf. 1;A\r\nF2;"Libellé ""cité""";"Ligne 1\nligne 2 ; suite";A\r\nF3;Hors filtre;;B\r\n;Sans code;;A\r\nF1;Doublon;;A\r\n';

describe('lecture des fichiers', () => {
  it('devine le séparateur', () => {
    expect(detectDelimiter('a;b;c')).toBe(';');
    expect(detectDelimiter('a\tb')).toBe('\t');
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('seul')).toBe(',');
  });

  it('analyse un CSV avec BOM, guillemets doublés et retours à la ligne dans un champ', () => {
    const rows = parseCsv(CSV);
    expect(rows[0]).toEqual(['identifiant', 'intitule', 'texte', 'type']);
    expect(rows[2]).toEqual(['F2', 'Libellé "cité"', 'Ligne 1\nligne 2 ; suite', 'A']);
    expect(rows).toHaveLength(6);
  });

  it('lit un JSON (tableau d’objets)', () => {
    const { columns, records } = jsonToRecords([{ code: 'X', libelle: ' Y ', n: 3 }, 'ignoré', { code: 'Z', objet: { a: 1 } }]);
    expect(columns).toEqual(['code', 'libelle', 'n', 'objet']);
    expect(records).toEqual([{ code: 'X', libelle: 'Y', n: '3' }, { code: 'Z', objet: '' }]);
  });
});

describe('extraction des éléments', () => {
  const input = toRecords(parseCsv(CSV));

  it('garde les colonnes demandées, applique le filtre, écarte vides et doublons', () => {
    const result = extractExternalSkills(input, { code: 'identifiant', label: 'intitule', definition: 'texte', filter: { column: 'type', values: ['A'] } });
    expect(result.errors).toEqual([]);
    expect(result.skills).toEqual([
      { code: 'F1', label: 'Force de proposition', definition: 'Déf. 1', position: 0 },
      { code: 'F2', label: 'Libellé "cité"', definition: 'Ligne 1\nligne 2 ; suite', position: 1 },
    ]);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.join(' ')).toMatch(/vide/);
    expect(result.warnings.join(' ')).toMatch(/déjà présent/);
  });

  it('refuse un fichier sans les colonnes demandées, en listant celles qu’il contient', () => {
    const result = extractExternalSkills(input, { code: 'conceptUri', label: 'intitule' });
    expect(result.skills).toEqual([]);
    expect(result.errors[0]).toContain('conceptUri');
    expect(result.errors[0]).toContain('identifiant, intitule, texte, type');
  });

  it('n’invente pas de définition et ne tronque rien', () => {
    const long = toRecords([['c', 'l'], ['A', 'x'.repeat(301)], ['B', 'ok']]);
    const result = extractExternalSkills(long, { code: 'c', label: 'l' });
    expect(result.skills).toEqual([{ code: 'B', label: 'ok', definition: null, position: 0 }]);
    expect(result.warnings[0]).toMatch(/trop longue/);
  });

  it('signale un import vide', () => {
    expect(extractExternalSkills(input, { code: 'identifiant', label: 'intitule', filter: { column: 'type', values: ['Z'] } }).errors[0]).toMatch(/Aucun élément/);
  });
});

describe('propositions par libellé', () => {
  it('ne rapproche que les libellés identiques ou quasi identiques', () => {
    expect(normalizeLabel('  Esprit d’Équipe ! ')).toBe('esprit d equipe');
    expect(normalizeLabel('Cœur')).toBe('coeur');
    expect(labelMatch('Force de proposition', ' Force de proposition ')).toBe('identical');
    expect(labelMatch('Esprit d’équipe', "ESPRIT D'EQUIPE")).toBe('near_identical');
    expect(labelMatch('Adaptabilité', 'Adaptabilités')).toBeNull();
    expect(labelMatch('Organisation', 'Sens de l’organisation')).toBeNull();
    expect(labelMatch('', '')).toBeNull();
  });

  it('justifie chaque proposition et propose seulement', () => {
    const proposals = proposeLabelMatches(
      [
        { frameworkId: 'ct', frameworkName: 'Compétences transversales', code: 'force_de_proposition', name: 'Force de proposition' },
        { frameworkId: 'ct', frameworkName: 'Compétences transversales', code: 'organisation', name: 'Organisation' },
      ],
      [
        { id: 'e1', code: 'F1', label: 'Force de proposition' },
        { id: 'e2', code: 'F2', label: 'Sens de l’organisation' },
      ],
      'Référentiel fictif 0',
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ frameworkId: 'ct', skillCode: 'force_de_proposition', externalSkillId: 'e1', match: 'identical', linkType: 'equivalent' });
    expect(proposals[0]!.justification).toContain('Libellé identique');
    expect(proposals[0]!.justification).toContain('Référentiel fictif 0, F1');
    expect(proposals[0]!.justification).toMatch(/avant de valider/);
    expect(proposals[0]).not.toHaveProperty('status');
  });
});
