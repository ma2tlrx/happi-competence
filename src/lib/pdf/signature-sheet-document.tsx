import { join } from 'node:path';

import { Document, Image, Page, Path, Svg, Text, View } from '@react-pdf/renderer';

import { TRAINING_ORGANISATION, type SignatureSheet } from '@/lib/attendance/documents';
import { SIGNATURE_HEIGHT, SIGNATURE_METHOD_LABEL, SIGNATURE_WIDTH } from '@/lib/attendance/signature';
import { formatDate, formatDateTime, formatTimeRange } from '@/lib/utils';

import { C, registerReportFonts } from './report/theme';

export function SignatureImage({ path, width, color = C.ink }: { path: string; width: number; color?: string }) {
  return (
    <Svg viewBox={`0 0 ${SIGNATURE_WIDTH} ${SIGNATURE_HEIGHT}`} style={{ width, height: (width * SIGNATURE_HEIGHT) / SIGNATURE_WIDTH }}>
      <Path d={path} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const cell = { paddingVertical: 5, paddingHorizontal: 6 };
const widths = { name: '24%', status: '15%', signature: '27%', time: '14%', method: '20%' };
const label = { fontSize: 7, color: C.subtle, letterSpacing: 0.5, textTransform: 'uppercase' as const };

function Info({ title, value }: { title: string; value: string }) {
  return (
    <View style={{ width: '25%', paddingRight: 10, marginBottom: 8 }}>
      <Text style={label}>{title}</Text>
      <Text style={{ fontSize: 9.5, marginTop: 1 }}>{value}</Text>
    </View>
  );
}

/**
 * Feuille d'émargement d'une séance : liste des participants, statut, signature et
 * heure, contre-signature du formateur, empreinte SHA-256 de l'ensemble en pied de page.
 */
export function SignatureSheetDocument({
  sheet,
  generatedAt,
  partial = false,
  root = process.cwd(),
}: {
  sheet: SignatureSheet;
  generatedAt: Date;
  /** Extrait limité aux participants visibles (organisme). */
  partial?: boolean;
  root?: string;
}) {
  registerReportFonts(root);
  const { session } = sheet;
  return (
    <Document title={`Feuille d’émargement — Session ${session.number}`} author={TRAINING_ORGANISATION.name} language="fr-FR">
      <Page size="A4" orientation="landscape" style={{ paddingTop: 34, paddingBottom: 70, paddingHorizontal: 40, fontFamily: 'DM Sans', fontSize: 9, color: C.ink }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 8.5, color: C.orange700, letterSpacing: 1.2 }}>
              {`SESSION ${session.number} · ${session.title.toUpperCase()}`}
            </Text>
            <Text style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 20, color: C.petrol, marginTop: 2 }}>Feuille d’émargement</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, pas d'attribut alt */}
          <Image src={join(root, 'public', 'brand', 'happi-logotype-petrole.png')} style={{ width: 80, height: 30 }} />
        </View>
        <View style={{ height: 2, width: 36, backgroundColor: C.orange, marginTop: 8, marginBottom: 12 }} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.paper, borderRadius: 4, paddingTop: 10, paddingHorizontal: 12 }}>
          <Info title="Organisme de formation" value={TRAINING_ORGANISATION.name} />
          <Info title="Structure" value={sheet.organizationName ?? '—'} />
          <Info title="Groupe" value={sheet.groupName} />
          <Info title="Programme" value={sheet.programName} />
          <Info title="Date" value={formatDate(session.date)} />
          <Info title="Horaires" value={formatTimeRange(session.startTime, session.endTime)} />
          <Info title="Lieu" value={session.location ?? '—'} />
          <Info title="Formateur" value={sheet.trainers.join(', ') || '—'} />
        </View>
        {partial ? (
          <Text style={{ marginTop: 6, fontSize: 8, color: C.muted }}>Extrait limité aux participants rattachés à votre structure.</Text>
        ) : null}

        <View style={{ marginTop: 12, borderTopWidth: 1, borderColor: C.lineStrong }}>
          <View style={{ flexDirection: 'row', backgroundColor: C.petrol50, borderBottomWidth: 1, borderColor: C.lineStrong, fontWeight: 700 }} fixed>
            <Text style={[cell, { width: widths.name }]}>Participant</Text>
            <Text style={[cell, { width: widths.status }]}>Présence</Text>
            <Text style={[cell, { width: widths.signature }]}>Signature</Text>
            <Text style={[cell, { width: widths.time }]}>Signé le</Text>
            <Text style={[cell, { width: widths.method }]}>Recueil</Text>
          </View>
          {sheet.rows.map((row) => (
            <View key={row.participantId} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: C.line, minHeight: 40, alignItems: 'center' }} wrap={false}>
              <Text style={[cell, { width: widths.name, fontWeight: 700 }]}>{`${row.lastName.toUpperCase()} ${row.firstName}`}</Text>
              <View style={[cell, { width: widths.status }]}>
                <Text>{row.statusLabel}</Text>
                {row.corrected ? <Text style={{ fontSize: 7, color: C.orange700 }}>Corrigé après contre-signature</Text> : null}
              </View>
              <View style={[cell, { width: widths.signature }]}>
                {row.signature?.kind === 'drawn' && row.signature.path ? (
                  <SignatureImage path={row.signature.path} width={110} />
                ) : row.signature?.kind === 'unable' ? (
                  <Text style={{ fontSize: 8 }}>{`Signature impossible — motif : ${row.signature.reason ?? ''}`}</Text>
                ) : (
                  <Text style={{ color: C.subtle, fontStyle: 'italic' }}>Non signé</Text>
                )}
                {row.signature && !row.signature.verified ? (
                  <Text style={{ fontSize: 7, color: C.orange700, fontWeight: 700 }}>ATTENTION : empreinte non concordante</Text>
                ) : null}
              </View>
              <Text style={[cell, { width: widths.time }]}>{row.signature ? formatDateTime(row.signature.signedAt) : ''}</Text>
              <View style={[cell, { width: widths.method }]}>
                <Text>{row.signature ? (SIGNATURE_METHOD_LABEL[row.signature.method] ?? row.signature.method) : ''}</Text>
                {row.signature ? <Text style={{ fontSize: 6, color: C.subtle }}>{`SHA-256 ${row.signature.sha256.slice(0, 16)}…`}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 14, flexDirection: 'row', gap: 16 }} wrap={false}>
          <View style={{ flex: 1, borderWidth: 0.75, borderColor: C.line, borderRadius: 4, padding: 10 }}>
            <Text style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 10.5, color: C.petrol }}>Contre-signature du formateur</Text>
            {sheet.countersignature ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 14 }}>
                <SignatureImage path={sheet.countersignature.path} width={140} />
                <View style={{ flex: 1 }}>
                  <Text>{`${sheet.countersignature.trainerName} atteste l’exactitude de la liste des présences.`}</Text>
                  <Text style={{ color: C.muted, marginTop: 2 }}>{`Contre-signé le ${formatDateTime(sheet.countersignature.signedAt)} : feuille figée.`}</Text>
                  <Text style={{ fontSize: 6.5, color: C.subtle, marginTop: 2 }}>{`SHA-256 ${sheet.countersignature.sha256}`}</Text>
                  {!sheet.countersignature.verified ? (
                    <Text style={{ fontSize: 7, color: C.orange700, fontWeight: 700 }}>ATTENTION : empreinte non concordante</Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text style={{ marginTop: 4, color: C.orange700 }}>Feuille non contre-signée : document provisoire, susceptible d’évoluer.</Text>
            )}
          </View>
        </View>

        <View style={{ position: 'absolute', bottom: 22, left: 40, right: 40, fontSize: 7, color: C.subtle }} fixed>
          <Text>{`Empreinte SHA-256 des données de la feuille : ${sheet.fingerprint}`}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text>
              {`Générée le ${formatDateTime(generatedAt)} · ${TRAINING_ORGANISATION.name} · Valeur probante : à valider avec votre financeur.`}
            </Text>
            <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
