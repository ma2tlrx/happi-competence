import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { CV_METHOD_MENTION, type SkillsCv } from '@/lib/skills-cv';
import { formatDate } from '@/lib/utils';

// Pas de césure : les noms de compétences restent entiers.
Font.registerHyphenationCallback((word) => [word]);

const C = { petrol: '#102c32', petrolLight: '#e3edef', orange: '#ea632e', ink: '#102c32', muted: '#4b6166', line: '#e5e5e0', paper: '#f5f5f2' };

const s = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 40, fontFamily: 'Helvetica', fontSize: 9.5, color: C.ink, lineHeight: 1.4 },
  band: { backgroundColor: C.petrol, paddingHorizontal: 40, paddingTop: 26, paddingBottom: 20, flexDirection: 'row', alignItems: 'center' },
  kicker: { fontSize: 9, color: '#a5c3c9' },
  title: { fontSize: 21, lineHeight: 1.25, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginTop: 5 },
  subtitle: { fontSize: 10, color: '#cadce0', marginTop: 5 },
  body: { paddingHorizontal: 40, paddingTop: 16 },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 3 },
  skill: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.line },
  skillName: { width: 170, fontFamily: 'Helvetica-Bold', fontSize: 9.5, paddingRight: 8 },
  level: { fontSize: 9.5, color: C.petrol, fontFamily: 'Helvetica-Bold' },
  descriptor: { fontSize: 8.5, color: C.muted, marginTop: 1 },
  mapping: { fontSize: 8, color: C.petrol, marginTop: 1 },
  method: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.paper, borderRadius: 6, padding: 10, marginTop: 14 },
  footer: { position: 'absolute', bottom: 18, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.muted, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 5 },
});

/** CV de compétences d'une page : compétences observées choisies par le participant. */
export function SkillsCvDocument({ cv, mascotPath, generatedAt, qr = null }: { cv: SkillsCv; mascotPath: string; generatedAt: Date; qr?: string | null }) {
  const dates = cv.program?.startDate ? `du ${formatDate(cv.program.startDate)} au ${formatDate(cv.program.endDate)}` : null;
  return (
    <Document title={`Mes compétences observées — ${cv.name}`} author="HAPPI Compétence" subject="Compétences observées" language="fr-FR">
      {/* Une seule page : le choix des compétences est borné en amont. */}
      <Page size="A4" style={s.page} wrap={false}>
        <View style={s.band}>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>HAPPI Compétence · Mes compétences observées</Text>
            <Text style={s.title}>{cv.name}</Text>
            <Text style={s.subtitle}>{[cv.program?.name, dates].filter(Boolean).join(' · ') || 'Programme HAPPI'}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, pas d'attribut alt */}
          <Image src={mascotPath} style={{ width: 48, height: 48 }} />
        </View>

        <View style={s.body}>
          {cv.frameworks.length === 0 ? <Text style={s.descriptor}>Aucune compétence sélectionnée.</Text> : null}
          {cv.frameworks.map((framework) => (
            <View key={framework.name}>
              <Text style={s.h2}>
                {framework.name}
                {framework.isProvisional ? <Text style={{ fontSize: 8, fontFamily: 'Helvetica', color: C.muted }}>  · référentiel en cours de validation</Text> : null}
              </Text>
              {framework.skills.map((skill) => (
                <View key={skill.code} style={s.skill}>
                  <Text style={s.skillName}>{skill.name}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.level}>
                      {skill.levelLabel}
                      {skill.toConfirm ? <Text style={{ fontFamily: 'Helvetica', color: C.muted, fontSize: 8.5 }}> · observée une fois, à confirmer</Text> : null}
                    </Text>
                    {skill.descriptor ? <Text style={s.descriptor}>{skill.descriptor}</Text> : null}
                    {skill.mappings.length > 0 ? (
                      <Text style={s.mapping}>
                        Référentiels publics : {skill.mappings.map((mapping) => `${mapping.label} (${mapping.linkLabel}, ${mapping.source})`).join(' ; ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ))}

          <View style={s.method}>
            {qr ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, pas d'attribut alt
              <Image src={qr} style={{ width: 64, height: 64 }} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.5, marginBottom: 2 }}>Méthode</Text>
              <Text style={{ fontSize: 8.5, color: C.muted }}>
                {CV_METHOD_MENTION} Chaque niveau a été attribué et validé par un formateur, à partir de comportements observés pendant les mises en situation
                du programme (jeux coopératifs, débats, débriefings), à un moment donné.
              </Text>
              {cv.mappingSources.length > 0 ? (
                <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 3 }}>
                  Correspondances avec les référentiels publics établies et validées par l’équipe HAPPI, sans effet sur les niveaux observés. Sources :{' '}
                  {cv.mappingSources.join(' ; ')}.
                </Text>
              ) : null}
              {qr ? <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 3 }}>Scannez le QR code pour vérifier ces compétences en ligne (lien à durée limitée, révocable).</Text> : null}
            </View>
          </View>
        </View>

        <View style={s.footer}>
          <Text>HAPPI Compétence · document établi à la demande du participant</Text>
          <Text>Édité le {formatDate(generatedAt.toISOString())}</Text>
        </View>
      </Page>
    </Document>
  );
}
