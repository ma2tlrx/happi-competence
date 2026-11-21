import { describe, expect, it } from 'vitest';

import { HELP_AUDIENCES, HELP_FAQ, HELP_GUIDES, guideText, matchesHelp } from './content';

describe('centre d’aide', () => {
  it('chaque espace a au moins un guide, et les identifiants sont uniques', () => {
    for (const audience of Object.keys(HELP_AUDIENCES)) expect(HELP_GUIDES.some((guide) => guide.audience === audience)).toBe(true);
    const ids = [...HELP_GUIDES.map((guide) => guide.id), ...HELP_FAQ.map((item) => item.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('la recherche ignore accents et casse, et exige tous les mots', () => {
    expect(matchesHelp('Signer la feuille d’émargement', 'EMARGEMENT')).toBe(true);
    expect(matchesHelp('Signer la feuille d’émargement', 'signer feuille')).toBe(true);
    expect(matchesHelp('Signer la feuille d’émargement', 'signer bilan')).toBe(false);
    expect(matchesHelp('Peu importe', '   ')).toBe(true);
  });

  it('retrouve le guide d’émargement par un mot de ses étapes', () => {
    expect(HELP_GUIDES.filter((guide) => matchesHelp(guideText(guide), 'contre-signer')).map((guide) => guide.id)).toContain('presences');
  });

  it('le guide de planification présente l’aide « Recopier sur les suivantes »', () => {
    expect(HELP_GUIDES.filter((guide) => matchesHelp(guideText(guide), 'recopier suivantes')).map((guide) => guide.id)).toContain('planifier');
  });
});
