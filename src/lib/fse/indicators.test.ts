import { describe, expect, it } from 'vitest';

import { OUTCOME_SITUATION_CODES } from '@/lib/outcomes/labels';

import { completeness, iscedFor, missingCoreFields, type EntryProfileValues } from './codes';
import { fseIndicatorsCsv, fseParticipantsCsv } from './csv';
import { buildFseReport, computeFseIndicators, buildJourneys, type FseDataset, type FseProfile, type IndicatorRow } from './indicators';
import { EMPLOYMENT_SITUATIONS, SITUATION_TO_RESULT, exitWindowPosition, resultFor } from './outcomes';

const TODAY = '2026-11-18';

const group = (id: string, endDate: string, status = 'completed', organizationId = 'o1') => ({
  id,
  name: `Groupe ${id}`,
  programId: 'p1',
  programName: 'HAPPI',
  organizationId,
  organizationName: 'ML',
  startDate: '2026-01-01',
  endDate,
  status,
});
const participant = (id: string, organizationId: string | null = 'o1') => ({
  id,
  firstName: id,
  lastName: id.toUpperCase(),
  organizationId,
  organizationName: organizationId ? `Org ${organizationId}` : null,
});
const member = (participantId: string, groupId: string, status = 'active', droppedAt: string | null = null) => ({
  groupId,
  participantId,
  status,
  dropReason: status === 'dropped' ? 'sante' : null,
  droppedAt,
});
const profile = (participantId: string, groupId: string | null, values: Partial<EntryProfileValues> = {}): FseProfile => ({
  participantId,
  groupId,
  entryDate: '2026-01-05',
  gender: 'femme',
  ageBand: '18_29',
  labourStatus: 'chomeur',
  unemploymentDuration: '12_23_mois',
  diplomaLevel: 'niveau_3',
  answers: {},
  ...values,
});

function dataset(overrides: Partial<FseDataset> = {}): FseDataset {
  return {
    groups: [group('g1', '2026-06-30')],
    participants: [participant('a'), participant('b'), participant('c'), participant('d')],
    memberships: [member('a', 'g1'), member('b', 'g1'), member('c', 'g1'), member('d', 'g1')],
    sessions: [],
    outcomes: [],
    profiles: [],
    ...overrides,
  };
}

const row = (rows: IndicatorRow[], code: string) => rows.find((item) => item.code === code)!;
const national = (rows: IndicatorRow[], label: string) => rows.find((item) => item.code === null && item.label.includes(label))!;

describe('correspondance situations → indicateurs de résultat FSE+', () => {
  it('chaque situation HAPPI a une correspondance explicite (éventuellement aucune)', () => {
    expect(Object.keys(SITUATION_TO_RESULT).sort()).toEqual([...OUTCOME_SITUATION_CODES].sort());
  });

  it('emploi, formation, recherche ; immersion, autre étape et sans nouvelles ne comptent pas', () => {
    expect(resultFor('emploi_durable')).toBe('EECR04');
    expect(resultFor('emploi_transition')).toBe('EECR04');
    expect(resultFor('creation_activite')).toBe('EECR04');
    expect(resultFor('formation_qualifiante')).toBe('EECR02');
    expect(resultFor('formation_autre')).toBe('EECR02');
    expect(resultFor('recherche_emploi')).toBe('EECR01');
    expect(resultFor('immersion_stage')).toBeNull();
    expect(resultFor('autre_etape')).toBeNull();
    expect(resultFor('sans_nouvelles')).toBeNull();
    expect(resultFor('inconnu')).toBeNull();
    expect(EMPLOYMENT_SITUATIONS.sort()).toEqual(['creation_activite', 'emploi_durable', 'emploi_transition']);
  });

  it('fenêtre de sortie : de la date de sortie à +28 jours', () => {
    expect(exitWindowPosition('2026-06-30', '2026-06-30')).toBe('within');
    expect(exitWindowPosition('2026-06-30', '2026-07-28')).toBe('within');
    expect(exitWindowPosition('2026-06-30', '2026-07-29')).toBe('after');
    expect(exitWindowPosition('2026-06-30', '2026-06-29')).toBe('before');
    expect(exitWindowPosition(null, '2026-06-29')).toBe('unknown');
  });
});

describe('nomenclatures', () => {
  it('niveau français 2019 → CITE', () => {
    expect(iscedFor('sans_diplome')).toBe('cite_0_2');
    expect(iscedFor('niveau_2')).toBe('cite_0_2');
    expect(iscedFor('niveau_3')).toBe('cite_3_4');
    expect(iscedFor('niveau_4')).toBe('cite_3_4');
    expect(iscedFor('niveau_5')).toBe('cite_5_8');
    expect(iscedFor('niveau_8')).toBe('cite_5_8');
    expect(iscedFor(null)).toBeNull();
  });

  it('complétude : date d’entrée, statut (et durée si chômeur), diplôme, âge, genre', () => {
    expect(completeness(null)).toBe('missing');
    expect(completeness(profile('a', 'g1'))).toBe('complete');
    expect(missingCoreFields(profile('a', 'g1', { unemploymentDuration: null }))).toEqual(['durée de chômage']);
    expect(completeness(profile('a', 'g1', { labourStatus: 'inactif', unemploymentDuration: null }))).toBe('complete');
    expect(completeness(profile('a', 'g1', { entryDate: null }))).toBe('partial');
  });
});

describe('indicateurs de réalisation', () => {
  const data = dataset({
    profiles: [
      profile('a', 'g1', { answers: { disability: 'oui', qpv_resident: 'oui', rural_area: 'ne_sait_pas' } }),
      profile('b', 'g1', { gender: 'homme', labourStatus: 'chomeur', unemploymentDuration: 'moins_6_mois', answers: { disability: 'ne_souhaite_pas_repondre' } }),
      // Fiche hors groupe : utilisée à défaut d'une fiche pour le groupe.
      profile('c', null, { gender: null, labourStatus: 'inactif', unemploymentDuration: null, diplomaLevel: 'niveau_6', ageBand: '55_plus', answers: { disability: 'non' } }),
      // d : aucune fiche.
    ],
  });
  const { summary, rows } = computeFseIndicators(buildJourneys(data, TODAY));

  it('résumé de complétude', () => {
    expect(summary).toEqual({ journeys: 4, complete: 2, partial: 1, missing: 1 });
  });

  it('effectifs, non renseignés comptés à part (jamais à zéro)', () => {
    expect(row(rows, 'EECO01')).toMatchObject({ count: 4, base: 4, notRecorded: 0 });
    expect(row(rows, 'EECO02')).toMatchObject({ count: 2, notRecorded: 1, base: 4 });
    expect(row(rows, 'EECO03')).toMatchObject({ count: 1, notRecorded: 1 });
    expect(row(rows, 'EECO04')).toMatchObject({ count: 1, notRecorded: 1 });
    expect(row(rows, 'EECO07')).toMatchObject({ count: 2, notRecorded: 1 });
    expect(row(rows, 'EECO08')).toMatchObject({ count: 1 });
    expect(row(rows, 'EECO10')).toMatchObject({ count: 2, notRecorded: 1 });
    expect(row(rows, 'EECO11')).toMatchObject({ count: 1 });
  });

  it('données facultatives : « ne souhaite pas répondre » et « ne sait pas » séparés', () => {
    expect(row(rows, 'EECO12')).toMatchObject({ count: 1, declined: 1, notRecorded: 1, unknown: 0, base: 4 });
    expect(row(rows, 'EECO17')).toMatchObject({ count: 0, unknown: 1, notRecorded: 3 });
    expect(national(rows, 'QPV')).toMatchObject({ count: 1, notRecorded: 3 });
  });

  it('ventilation par genre de l’effectif concerné', () => {
    expect(row(rows, 'EECO02').byGender).toEqual({ femme: 1, homme: 1, non_binaire: 0, non_communique: 0 });
    expect(row(rows, 'EECO04').byGender).toEqual({ femme: 0, homme: 0, non_binaire: 0, non_communique: 1 });
  });
});

describe('indicateurs de résultat', () => {
  const data = dataset({
    groups: [group('g1', '2026-06-30'), group('g2', '2026-12-31', 'active')],
    memberships: [member('a', 'g1'), member('b', 'g1'), member('c', 'g1'), member('d', 'g1', 'dropped', '2026-03-01'), member('e', 'g2')],
    participants: [participant('a'), participant('b'), participant('c'), participant('d'), participant('e', 'o2')],
    profiles: [profile('a', 'g1'), profile('b', 'g1', { gender: 'homme' })],
    outcomes: [
      { participantId: 'a', groupId: 'g1', kind: 'exit', situation: 'emploi_durable', observedOn: '2026-07-10', qualificationObtained: false },
      { participantId: 'b', groupId: 'g1', kind: 'exit', situation: 'formation_autre', observedOn: '2026-07-01', qualificationObtained: true },
      // Hors délai : observée plus de 4 semaines après la sortie.
      { participantId: 'c', groupId: 'g1', kind: 'exit', situation: 'emploi_transition', observedOn: '2026-09-15', qualificationObtained: null },
      { participantId: 'd', groupId: 'g1', kind: 'exit', situation: 'sans_nouvelles', observedOn: '2026-03-10', qualificationObtained: null },
      { participantId: 'a', groupId: 'g1', kind: 'followup_6m', situation: 'emploi_transition', observedOn: '2026-11-01', qualificationObtained: null },
    ],
  });
  const report = buildFseReport(data, {}, TODAY);
  const { rows } = report.total;

  it('seules les sorties attendues forment la base ; le parcours en cours est exclu', () => {
    expect(row(rows, 'EECR04').base).toBe(4);
    expect(row(rows, 'EECO01').base).toBe(5);
  });

  it('EECR01 à EECR04 : fenêtre de 4 semaines, sans nouvelles et non renseigné à part', () => {
    expect(row(rows, 'EECR04')).toMatchObject({ count: 1, outOfWindow: 1, unknown: 1, notRecorded: 0 });
    expect(row(rows, 'EECR02')).toMatchObject({ count: 1 });
    expect(row(rows, 'EECR01')).toMatchObject({ count: 0 });
    expect(row(rows, 'EECR03')).toMatchObject({ count: 1, notRecorded: 1, outOfWindow: 1 });
    expect(row(rows, 'EECR04').byGender.femme).toBe(1);
  });

  it('EECR05 : emploi au suivi à 6 mois ; un suivi attendu non saisi est « non renseigné »', () => {
    // d : abandon le 01/03, suivi attendu non saisi ; a : saisi (compté même avant l’échéance) ; b et c : pas encore attendus.
    expect(row(rows, 'EECR05')).toMatchObject({ count: 1, base: 2, notRecorded: 1 });
  });

  it('EECR06 n’est pas calculé', () => {
    expect(row(rows, 'EECR06')).toMatchObject({ computed: false, base: 0, count: 0 });
  });

  it('agrégats par cohorte et par organisme', () => {
    expect(report.cohorts.map((cohort) => [cohort.group.id, row(cohort.indicators.rows, 'EECO01').count])).toEqual([
      ['g1', 4],
      ['g2', 1],
    ]);
    expect(report.organizations.map((organization) => organization.organizationName)).toEqual(['Org o1', 'Org o2']);
    const filtered = buildFseReport(data, { organizationId: 'o2' }, TODAY);
    expect(row(filtered.total.rows, 'EECO01').count).toBe(1);
  });

  it('exports CSV : une ligne par parcours, « Non renseigné » plutôt que 0', () => {
    const participants = fseParticipantsCsv(report.journeys).split('\r\n');
    expect(participants).toHaveLength(report.journeys.length + 2);
    expect(participants.find((line) => line.startsWith('"C";'))).toContain('"Fiche non commencée"');
    expect(participants.find((line) => line.startsWith('"C";'))).toContain('"Non (après 28 jours)"');
    const aggregated = fseIndicatorsCsv(report);
    expect(aggregated).toContain('"EECR06"');
    expect(aggregated).toContain('"Non calculé"');
  });
});
