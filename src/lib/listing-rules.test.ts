import { describe, expect, it } from 'vitest';

import { displayGroupStatus, filterOrgParticipants, isUpcomingSession, orgParticipantFilterQuery } from './listing-rules';

const today = '2026-11-17';

describe('displayGroupStatus', () => {
  it('affiche « prévu » un groupe en cours qui n’a pas commencé', () => {
    expect(displayGroupStatus({ status: 'active', startDate: '2026-12-01' }, today)).toBe('planned');
  });
  it('garde « en cours » le jour du début, après, ou sans date', () => {
    expect(displayGroupStatus({ status: 'active', startDate: today }, today)).toBe('active');
    expect(displayGroupStatus({ status: 'active', startDate: '2026-10-01' }, today)).toBe('active');
    expect(displayGroupStatus({ status: 'active', startDate: null }, today)).toBe('active');
  });
  it('ne touche pas aux autres statuts', () => {
    expect(displayGroupStatus({ status: 'completed', startDate: '2026-12-01' }, today)).toBe('completed');
  });
});

describe('isUpcomingSession', () => {
  it('compte les séances prévues à partir d’aujourd’hui et celles sans date', () => {
    expect(isUpcomingSession({ status: 'planned', date: today }, today)).toBe(true);
    expect(isUpcomingSession({ status: 'planned', date: '2026-12-01' }, today)).toBe(true);
    expect(isUpcomingSession({ status: 'planned', date: null }, today)).toBe(true);
  });
  it('exclut une séance en cours, passée, terminée ou annulée', () => {
    expect(isUpcomingSession({ status: 'in_progress', date: today }, today)).toBe(false);
    expect(isUpcomingSession({ status: 'planned', date: '2026-11-01' }, today)).toBe(false);
    expect(isUpcomingSession({ status: 'completed', date: '2026-12-01' }, today)).toBe(false);
    expect(isUpcomingSession({ status: 'cancelled', date: '2026-12-01' }, today)).toBe(false);
  });
});

describe('filtres des participants d’un organisme', () => {
  const rows = [
    { firstName: 'Inès', lastName: 'Martin', email: 'ines@exemple.fr', groupId: 'g1', programName: 'HAPPI' },
    { firstName: 'Lucas', lastName: 'Benali', email: null, groupId: 'g2', programName: 'HAPPI' },
    { firstName: 'Nora', lastName: 'Roux', email: null, groupId: null, programName: null },
  ];
  it('recherche sans accents ni casse, puis groupe et programme', () => {
    expect(filterOrgParticipants(rows, { q: 'ines' }).map((row) => row.lastName)).toEqual(['Martin']);
    expect(filterOrgParticipants(rows, { groupe: 'g2' }).map((row) => row.lastName)).toEqual(['Benali']);
    expect(filterOrgParticipants(rows, { programme: 'HAPPI', q: 'BEN' }).map((row) => row.lastName)).toEqual(['Benali']);
    expect(filterOrgParticipants(rows, {})).toHaveLength(3);
  });
  it('construit la requête d’export des seuls filtres actifs', () => {
    expect(orgParticipantFilterQuery({})).toBe('');
    expect(orgParticipantFilterQuery({ q: ' Inès ', groupe: '', programme: 'HAPPI' })).toBe('?q=In%C3%A8s&programme=HAPPI');
  });
});
