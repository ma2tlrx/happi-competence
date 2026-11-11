import { join } from 'node:path';

import { Font, StyleSheet } from '@react-pdf/renderer';

/**
 * Charte éditoriale des bilans : la palette HAPPI (pétrole, orange rare, papier),
 * DM Sans pour le texte et Poppins pour les titres, comme sur le site.
 */
export const C = {
  petrol: '#102c32',
  petrol800: '#173a41',
  petrol600: '#2f6873',
  petrol400: '#76a3ac',
  petrol200: '#cadce0',
  petrol100: '#e3edef',
  petrol50: '#f1f6f7',
  orange: '#ea632e',
  orange700: '#b8431a',
  orange100: '#fce5da',
  ink: '#102c32',
  muted: '#4b6166',
  subtle: '#5c7277',
  line: '#e5e5e0',
  lineStrong: '#d3d3cb',
  paper: '#f5f5f2',
  white: '#ffffff',
  observed: '#00819b',
  observedTrack: '#e3edef',
};

/** Rampe séquentielle pétrole pour les niveaux : du plus clair (premier niveau) au plus foncé. Jamais de rouge. */
const RAMP = ['#cadce0', '#a5c3c9', '#76a3ac', '#2f6873', '#102c32'];
export function levelColor(value: number, min: number, max: number) {
  const ratio = max > min ? (value - min) / (max - min) : 1;
  return RAMP[Math.round(ratio * (RAMP.length - 1))]!;
}

let registered = false;
export function registerReportFonts(root = process.cwd()) {
  if (registered) return;
  const dir = join(root, 'public', 'fonts', 'report');
  Font.register({
    family: 'DM Sans',
    fonts: [
      { src: join(dir, 'dm-sans-latin-400-normal.woff'), fontWeight: 400 },
      { src: join(dir, 'dm-sans-latin-400-italic.woff'), fontWeight: 400, fontStyle: 'italic' },
      { src: join(dir, 'dm-sans-latin-500-normal.woff'), fontWeight: 500 },
      { src: join(dir, 'dm-sans-latin-700-normal.woff'), fontWeight: 700 },
    ],
  });
  Font.register({
    family: 'Poppins',
    fonts: [
      { src: join(dir, 'poppins-latin-500-normal.woff'), fontWeight: 500 },
      { src: join(dir, 'poppins-latin-600-normal.woff'), fontWeight: 600 },
    ],
  });
  // Pas de césure automatique : les noms de compétences restent entiers.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

export const PAGE = { width: 595.28, height: 841.89, marginX: 50, top: 64, bottom: 64 };
export const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;

export const s = StyleSheet.create({
  page: { paddingTop: PAGE.top, paddingBottom: PAGE.bottom, paddingHorizontal: PAGE.marginX, fontFamily: 'DM Sans', fontSize: 9.5, lineHeight: 1.5, color: C.ink },
  header: { position: 'absolute', top: 26, left: PAGE.marginX, right: PAGE.marginX, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', fontSize: 7.5, color: C.subtle, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: C.line },
  footer: { position: 'absolute', bottom: 28, left: PAGE.marginX, right: PAGE.marginX, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.subtle },
  draft: { color: C.orange700, fontWeight: 700, letterSpacing: 1 },

  kicker: { fontFamily: 'Poppins', fontWeight: 600, fontSize: 9, color: C.orange700, letterSpacing: 1.2 },
  h1: { fontFamily: 'Poppins', fontWeight: 600, fontSize: 22, lineHeight: 1.2, color: C.petrol, marginTop: 4 },
  lead: { fontSize: 10.5, lineHeight: 1.55, color: C.muted, marginTop: 8, maxWidth: 440 },
  h2: { fontFamily: 'Poppins', fontWeight: 600, fontSize: 13, lineHeight: 1.3, color: C.petrol, marginTop: 22, marginBottom: 8 },
  h3: { fontFamily: 'Poppins', fontWeight: 600, fontSize: 10.5, lineHeight: 1.3, color: C.petrol },
  label: { fontSize: 7.5, color: C.subtle, letterSpacing: 0.6, textTransform: 'uppercase' },
  p: { marginBottom: 7 },
  muted: { color: C.muted },
  small: { fontSize: 8, color: C.muted, lineHeight: 1.45 },
  rule: { height: 2, width: 36, backgroundColor: C.orange, marginTop: 12 },

  box: { backgroundColor: C.paper, borderRadius: 4, padding: 14 },
  panel: { borderWidth: 0.75, borderColor: C.line, borderRadius: 4, padding: 12 },
  row: { flexDirection: 'row' },
  chip: { fontSize: 7.5, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, alignSelf: 'flex-start' },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletMark: { width: 8, height: 3, backgroundColor: C.orange, borderRadius: 1, marginTop: 5.5, marginRight: 8 },
  placeholder: { color: C.subtle, fontStyle: 'italic' },
});
