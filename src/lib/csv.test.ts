import { describe, expect, it } from 'vitest';

import { csvCell, toCsv } from './csv';

describe('export CSV', () => {
  it('neutralise les débuts de formule', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell('+33 6')).toBe('"\'+33 6"');
    expect(csvCell('-1')).toBe('"\'-1"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(csvCell('  =1+1')).toBe('"\'  =1+1"');
    expect(csvCell('\tcmd')).toBe('"\'\tcmd"');
  });

  it('laisse le texte ordinaire et les nombres intacts', () => {
    expect(csvCell('Très bien ; merci')).toBe('"Très bien ; merci"');
    expect(csvCell(4.5)).toBe('"4,5"');
    expect(csvCell(-20)).toBe('"-20"');
    expect(csvCell(null)).toBe('""');
  });

  it('assemble les lignes avec BOM et fins de ligne Windows', () => {
    expect(toCsv([['a', 1], ['b', 2]])).toBe('﻿"a";"1"\r\n"b";"2"\r\n');
  });
});
