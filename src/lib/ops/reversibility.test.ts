import { createHash } from 'node:crypto';

import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { archiveFilename, buildReversibilityArchive, tableToCsv, type ExportPayload } from './reversibility';

const payload: ExportPayload = {
  format: 'happi-reversibilite',
  format_version: 1,
  exported_at: '2026-11-16T10:00:00.000Z',
  scope: 'organisme',
  organization_id: '00000000-0000-0000-0000-000000000001',
  counts: { organismes: 1, participants: 2, bilans_finaux: 1 },
  data: {
    organismes: [{ id: '00000000-0000-0000-0000-000000000001', name: 'Mission Locale Été' }],
    participants: [
      { id: 'p1', first_name: 'Ana', last_name: '=HYPERLINK("x")', is_demo: false },
      { id: 'p2', first_name: 'Léo', last_name: 'Martin', phone: '06' },
    ],
    bilans_finaux: [{ id: 'b1', data: { scores: [1, 2] }, content: 'Texte ; avec "guillemets"' }],
  },
};

describe('archive de réversibilité', () => {
  it('convertit une table en CSV sûr (union des colonnes, JSON, formules neutralisées)', () => {
    const csv = tableToCsv(payload.data.participants);
    const [head, first, second] = csv.replace('﻿', '').trim().split('\r\n');
    expect(head).toBe('"id";"first_name";"last_name";"is_demo";"phone"');
    expect(first).toContain(`"'=HYPERLINK(""x"")"`);
    expect(first).toContain('"non"');
    expect(second).toContain('"06"');
    expect(tableToCsv(payload.data.bilans_finaux)).toContain('"{""scores"":[1,2]}"');
  });

  it('contient LISEZMOI, données, CSV et un manifeste d’empreintes exact', () => {
    const files = unzipSync(buildReversibilityArchive(payload, 'Mission Locale Été'));
    expect(Object.keys(files).sort()).toEqual([
      'LISEZMOI.md',
      'csv/bilans_finaux.csv',
      'csv/organismes.csv',
      'csv/participants.csv',
      'donnees.json',
      'manifeste.json',
    ]);
    expect(JSON.parse(strFromU8(files['donnees.json']))).toEqual(payload);
    expect(strFromU8(files['LISEZMOI.md'])).toContain('organisme « Mission Locale Été »');
    const manifest = JSON.parse(strFromU8(files['manifeste.json']));
    for (const [path, info] of Object.entries(manifest.files) as [string, { sha256: string; bytes: number }][]) {
      expect(createHash('sha256').update(files[path]).digest('hex')).toBe(info.sha256);
      expect(files[path].length).toBe(info.bytes);
    }
  });

  it('nomme le fichier sans caractère spécial', () => {
    expect(archiveFilename(payload, 'Mission Locale Été / Paris')).toBe('happi-export-mission-locale-ete-paris-2026-11-16.zip');
    expect(archiveFilename({ ...payload, scope: 'plateforme' }, null)).toBe('happi-export-plateforme-2026-11-16.zip');
  });
});
