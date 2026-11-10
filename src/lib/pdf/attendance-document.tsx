import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

Font.registerHyphenationCallback((word) => [word]);

export type AttendanceExportRow = { lastName: string; firstName: string; organization: string; status: string; comment: string; recordedAt: string; recordedBy: string };

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: '#102c32' },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  meta: { marginTop: 4, color: '#4b6166', fontSize: 9.5 },
  table: { marginTop: 18, borderTopWidth: 1, borderColor: '#d3d3cb' },
  head: { flexDirection: 'row', backgroundColor: '#f1f6f7', borderBottomWidth: 1, borderColor: '#d3d3cb', fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e5e0', minHeight: 30, alignItems: 'center' },
  cell: { paddingVertical: 5, paddingHorizontal: 5 },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 7.5, color: '#4b6166', flexDirection: 'row', justifyContent: 'space-between' },
});
const widths = { name: '24%', org: '18%', status: '13%', comment: '19%', recorded: '13%', sign: '13%' };

export function AttendanceDocument({ title, meta, rows, generatedAt }: { title: string; meta: string[]; rows: AttendanceExportRow[]; generatedAt: string }) {
  return (
    <Document title={title} author="HAPPI Compétence" language="fr-FR">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>{title}</Text>
        {meta.map((line) => (
          <Text key={line} style={s.meta}>{line}</Text>
        ))}
        <View style={s.table}>
          <View style={s.head} fixed>
            <Text style={[s.cell, { width: widths.name }]}>Participant</Text>
            <Text style={[s.cell, { width: widths.org }]}>Organisme</Text>
            <Text style={[s.cell, { width: widths.status }]}>Présence</Text>
            <Text style={[s.cell, { width: widths.comment }]}>Commentaire</Text>
            <Text style={[s.cell, { width: widths.recorded }]}>Validée le</Text>
            <Text style={[s.cell, { width: widths.sign }]}>Signature</Text>
          </View>
          {rows.map((row, index) => (
            <View key={index} style={s.row} wrap={false}>
              <Text style={[s.cell, { width: widths.name, fontFamily: 'Helvetica-Bold' }]}>{`${row.lastName.toUpperCase()} ${row.firstName}`}</Text>
              <Text style={[s.cell, { width: widths.org }]}>{row.organization}</Text>
              <Text style={[s.cell, { width: widths.status }]}>{row.status}</Text>
              <Text style={[s.cell, { width: widths.comment }]}>{row.comment}</Text>
              <Text style={[s.cell, { width: widths.recorded }]}>{row.recordedAt}</Text>
              <Text style={[s.cell, { width: widths.sign }]}> </Text>
            </View>
          ))}
        </View>
        <View style={s.footer} fixed>
          <Text>{`Feuille générée le ${generatedAt} · HAPPI Compétence`}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
