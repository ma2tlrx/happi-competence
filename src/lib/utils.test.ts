import { describe, expect, it } from 'vitest';

import { safeInternalPath } from './utils';

describe('safeInternalPath', () => {
  it('accepte un chemin interne, avec paramètres', () => {
    expect(safeInternalPath('/formateur/groupes?onglet=participants#liste')).toBe('/formateur/groupes?onglet=participants#liste');
  });

  it('refuse les redirections vers un autre domaine, même déguisées', () => {
    for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', '/%09/evil.example'.replace('%09', '\t'), ' /x', 'evil']) {
      expect(safeInternalPath(value, '/repli')).toBe('/repli');
    }
  });

  it('renvoie le repli si la valeur est vide', () => {
    expect(safeInternalPath('', '/connexion')).toBe('/connexion');
    expect(safeInternalPath(null)).toBe('/');
  });
});
