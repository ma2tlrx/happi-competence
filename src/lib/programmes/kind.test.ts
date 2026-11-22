import { describe, expect, it } from 'vitest';

import { effectiveProgramKind, parseProgramKind, programKindFromSlug, programSlug } from './kind';

describe('types de programme', () => {
  it('ne reconnaît que les deux programmes connus', () => {
    expect(parseProgramKind('passeport_numerique')).toBe('passeport_numerique');
    expect(parseProgramKind('happi_competence')).toBe('happi_competence');
    expect(parseProgramKind('autre')).toBeNull();
    expect(parseProgramKind(undefined)).toBeNull();
  });

  it('lit l’adresse lisible comme le code de la base, et inversement', () => {
    expect(programKindFromSlug('passeport-numerique')).toBe('passeport_numerique');
    expect(programKindFromSlug('happi')).toBe('happi_competence');
    expect(programKindFromSlug('passeport_numerique')).toBe('passeport_numerique');
    expect(programKindFromSlug('x')).toBeNull();
    expect(programSlug('passeport_numerique')).toBe('passeport-numerique');
    expect(programSlug('happi_competence')).toBe('happi-competence');
  });

  it('le programme du groupe prime sur le choix fait à l’inscription', () => {
    expect(effectiveProgramKind('happi_competence', 'passeport_numerique')).toBe('happi_competence');
    expect(effectiveProgramKind(null, 'passeport_numerique')).toBe('passeport_numerique');
    expect(effectiveProgramKind(undefined, undefined)).toBe('happi_competence');
    expect(effectiveProgramKind('inconnu', 'inconnu')).toBe('happi_competence');
  });
});
