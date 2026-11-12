import { join } from 'node:path';

import { Document, Image, Page, Text, View } from '@react-pdf/renderer';

import { TRAINING_ORGANISATION, type Certificate } from '@/lib/attendance/documents';
import { formatHours } from '@/lib/attendance/hours';
import { formatDate, formatDateTime } from '@/lib/utils';

import { C, registerReportFonts } from './report/theme';

const ATTENDANCE_LABEL: Record<string, string> = {
  present: 'Présent',
  late: 'En retard',
  left_early: 'Départ anticipé',
  absent: 'Absent',
  excused: 'Absence justifiée',
};
const SESSION_LABEL: Record<string, string> = { planned: 'À venir', in_progress: 'En cours', completed: 'Réalisée', cancelled: 'Annulée' };

function Line({ title, value }: { title: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 5 }}>
      <Text style={{ width: 150, color: C.muted }}>{title}</Text>
      <Text style={{ flex: 1, fontWeight: 700 }}>{value}</Text>
    </View>
  );
}

const cell = { paddingVertical: 4, paddingHorizontal: 6 };

/**
 * Certificat de réalisation (modèle indicatif) : heures réalisées et prévues d'un
 * participant pour un groupe, rubrique de signature du responsable à compléter.
 */
export function CertificateDocument({ certificate, generatedAt, root = process.cwd() }: { certificate: Certificate; generatedAt: Date; root?: string }) {
  registerReportFonts(root);
  const { participant, group, realisation } = certificate;
  const name = `${participant.firstName} ${participant.lastName}`;
  return (
    <Document title={`Certificat de réalisation — ${name}`} author={TRAINING_ORGANISATION.name} language="fr-FR">
      <Page size="A4" style={{ paddingTop: 44, paddingBottom: 70, paddingHorizontal: 50, fontFamily: 'DM Sans', fontSize: 9.5, lineHeight: 1.45, color: C.ink }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 8.5, color: C.orange700, letterSpacing: 1.2 }}>MODÈLE INDICATIF</Text>
            <Text style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 22, color: C.petrol, marginTop: 2 }}>Certificat de réalisation</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, pas d'attribut alt */}
          <Image src={join(root, 'public', 'brand', 'happi-logotype-petrole.png')} style={{ width: 86, height: 33 }} />
        </View>
        <View style={{ height: 2, width: 36, backgroundColor: C.orange, marginTop: 16, marginBottom: 16 }} />

        <Text style={{ marginBottom: 12 }}>
          {`Je soussigné(e), ……………………………………………, représentant(e) de l’organisme de formation ${TRAINING_ORGANISATION.name}, atteste que :`}
        </Text>

        <View style={{ backgroundColor: C.paper, borderRadius: 4, padding: 14 }}>
          <Line title="Participant" value={name} />
          <Line title="Structure" value={participant.organizationName ?? group.organizationName ?? '—'} />
          <Line title="Action de formation" value={`${certificate.programName} (groupe « ${group.name} »)`} />
          <Line title="Dates" value={`du ${formatDate(group.startDate, '—')} au ${formatDate(group.endDate, '—')}`} />
          <Line title="Modalité" value={certificate.modality} />
          <Line title="Durée prévue" value={`${formatHours(realisation.plannedMinutes)} (${realisation.plannedSessions} séances)`} />
          <Line
            title="Durée réalisée"
            value={`${formatHours(realisation.realisedMinutes)} (${realisation.attendedSessions} séance(s) suivie(s) sur ${realisation.completedSessions} réalisée(s))`}
          />
        </View>
        <Text style={{ marginTop: 6, fontSize: 8, color: C.muted }}>{`Organisme de formation : ${TRAINING_ORGANISATION.name} — ${TRAINING_ORGANISATION.legal}.`}</Text>

        <View style={{ marginTop: 16, borderTopWidth: 1, borderColor: C.lineStrong }}>
          <View style={{ flexDirection: 'row', backgroundColor: C.petrol50, borderBottomWidth: 1, borderColor: C.lineStrong, fontWeight: 700 }}>
            <Text style={[cell, { width: '12%' }]}>Séance</Text>
            <Text style={[cell, { width: '24%' }]}>Date</Text>
            <Text style={[cell, { width: '18%' }]}>Statut</Text>
            <Text style={[cell, { width: '22%' }]}>Présence</Text>
            <Text style={[cell, { width: '12%' }]}>Durée</Text>
            <Text style={[cell, { width: '12%' }]}>Retenue</Text>
          </View>
          {realisation.rows.map((row) => (
            <View key={row.sessionId} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: C.line }} wrap={false}>
              <Text style={[cell, { width: '12%' }]}>{String(row.number)}</Text>
              <Text style={[cell, { width: '24%' }]}>{formatDate(row.date, '—')}</Text>
              <Text style={[cell, { width: '18%' }]}>{SESSION_LABEL[row.status] ?? row.status}</Text>
              <Text style={[cell, { width: '22%' }]}>{row.attendance ? (ATTENDANCE_LABEL[row.attendance] ?? row.attendance) : '—'}</Text>
              <Text style={[cell, { width: '12%' }]}>{formatHours(row.minutes)}</Text>
              <Text style={[cell, { width: '12%' }]}>{row.counted ? formatHours(row.minutes) : '—'}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 22, flexDirection: 'row', gap: 20 }} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text>Fait à ……………………………………</Text>
            <Text style={{ marginTop: 8 }}>le ……………………………………</Text>
          </View>
          <View style={{ flex: 1.2, borderWidth: 0.75, borderColor: C.lineStrong, borderRadius: 4, padding: 10, minHeight: 90 }}>
            <Text style={{ fontWeight: 700 }}>Signature et cachet du responsable de l’organisme de formation</Text>
            <Text style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>À compléter</Text>
          </View>
        </View>

        <View style={{ marginTop: 18, borderLeftWidth: 2, borderColor: C.orange, paddingLeft: 10 }} wrap={false}>
          <Text style={{ fontWeight: 700, color: C.orange700 }}>Modèle indicatif, à confronter au modèle officiel du financeur — à valider.</Text>
          <Text style={{ fontSize: 8, color: C.muted, marginTop: 3 }}>
            Heures réalisées : séances terminées où le participant était présent, en retard ou parti plus tôt (séance comptée en entier). Durée de chaque
            séance selon les horaires renseignés, sinon selon la trame du programme (3 h par défaut). Les feuilles d’émargement signées de chaque séance
            constituent les justificatifs.
          </Text>
        </View>

        <View style={{ position: 'absolute', bottom: 24, left: 50, right: 50, fontSize: 7, color: C.subtle }} fixed>
          <Text>{`Empreinte SHA-256 des données : ${certificate.fingerprint}`}</Text>
          <Text style={{ marginTop: 2 }}>{`Généré le ${formatDateTime(generatedAt)} · ${TRAINING_ORGANISATION.name}`}</Text>
        </View>
      </Page>
    </Document>
  );
}
