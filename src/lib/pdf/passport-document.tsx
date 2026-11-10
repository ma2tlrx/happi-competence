import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { Passport, PassportFramework, PassportSkill } from '@/lib/passport';
import { formatDate, formatScore } from '@/lib/utils';

// Pas de césure : les noms de compétences restent entiers.
Font.registerHyphenationCallback((word) => [word]);

const C = { petrol: '#102c32', petrolMid: '#47828d', petrolLight: '#e3edef', orange: '#ea632e', ink: '#102c32', muted: '#4b6166', line: '#e5e5e0', paper: '#f5f5f2', observed: '#00819b', self: '#ea632e', selfLight: '#fce5da' };

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 0, fontFamily: 'Helvetica', fontSize: 9.5, color: C.ink, lineHeight: 1.4 },
  band: { marginTop: -36, backgroundColor: C.petrol, color: '#ffffff', paddingHorizontal: 40, paddingTop: 28, paddingBottom: 24, flexDirection: 'row', alignItems: 'center' },
  bandText: { flex: 1 },
  kicker: { fontSize: 9, color: '#a5c3c9' },
  title: { fontSize: 22, lineHeight: 1.25, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginTop: 6 },
  subtitle: { fontSize: 10, color: '#cadce0', marginTop: 6 },
  body: { paddingHorizontal: 40, paddingTop: 20 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 10 },
  statLabel: { fontSize: 8, color: C.muted },
  statValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 4 },
  note: { fontSize: 8.5, color: C.muted, marginBottom: 8 },
  category: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.muted, marginTop: 8, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  skillName: { width: 150, fontSize: 9 },
  meter: { flex: 1, flexDirection: 'row', gap: 2, marginRight: 10 },
  value: { width: 120, fontSize: 8.5, color: C.muted, textAlign: 'right' },
  highlightBox: { flexDirection: 'row', gap: 8, marginTop: 6 },
  highlight: { flex: 1, backgroundColor: C.paper, borderRadius: 6, padding: 9 },
  highlightTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  feedback: { borderLeftWidth: 2, borderLeftColor: C.orange, paddingLeft: 8, marginBottom: 8 },
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.muted, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 },
});

function Meter({ value, min, max, color, track }: { value: number | null; min: number; max: number; color: string; track: string }) {
  return (
    <View style={s.meter}>
      {Array.from({ length: max - min + 1 }, (_, index) => {
        const fill = value === null ? 0 : Math.max(0, Math.min(1, value - (min + index - 1)));
        return (
          <View key={index} style={{ flex: 1, height: 6, borderRadius: 2, backgroundColor: track, overflow: 'hidden' }}>
            <View style={{ width: `${fill * 100}%`, height: 6, backgroundColor: color }} />
          </View>
        );
      })}
    </View>
  );
}

function SkillRow({ skill, framework }: { skill: PassportSkill; framework: PassportFramework }) {
  const { scaleMin: min, scaleMax: max } = framework.rules;
  return (
    <View style={s.row} wrap={false}>
      <Text style={s.skillName}>{skill.name}</Text>
      <Meter value={skill.summary.value} min={min} max={max} color={C.observed} track={C.petrolLight} />
      <Text style={s.value}>{skill.summary.value === null ? 'Non observée' : `${formatScore(skill.summary.value)}/${max} · ${skill.level?.label ?? ''}`}</Text>
    </View>
  );
}

function names(framework: PassportFramework, codes: string[]) {
  return codes.map((code) => framework.skills.find((skill) => skill.code === code)?.name).filter(Boolean).join(', ');
}

export function PassportDocument({ passport, mascotPath, generatedAt }: { passport: Passport; mascotPath: string; generatedAt: Date }) {
  const { participant, group } = passport;
  const feedback = passport.evaluations.filter((evaluation) => evaluation.observation || evaluation.advice);
  return (
    <Document title={`Passeport de compétences — ${participant.firstName} ${participant.lastName}`} author="HAPPI Compétence" language="fr-FR">
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed={false}>
          <View style={s.bandText}>
            <Text style={s.kicker}>HAPPI Compétence · Passeport de compétences</Text>
            <Text style={s.title}>
              {participant.firstName} {participant.lastName}
            </Text>
            <Text style={s.subtitle}>
              {[participant.organization?.name, group?.programName, group?.startDate ? `du ${formatDate(group.startDate)} au ${formatDate(group.endDate)}` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, pas d'attribut alt */}
          <Image src={mascotPath} style={{ width: 54, height: 54 }} />
        </View>

        <View style={s.body}>
          <View style={s.stats}>
            <View style={s.stat}>
              <Text style={s.statLabel}>Sessions réalisées</Text>
              <Text style={s.statValue}>{passport.completedSessions}/{group?.sessionsCount ?? 6}</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>Sessions suivies</Text>
              <Text style={s.statValue}>{passport.attendedSessions}</Text>
            </View>
            {passport.frameworks.map((framework) => (
              <View key={framework.code} style={s.stat}>
                <Text style={s.statLabel}>{framework.shortName} observées</Text>
                <Text style={s.statValue}>
                  {framework.observedCount}/{framework.skills.length}
                </Text>
              </View>
            ))}
          </View>
          <Text style={s.note}>
            Les niveaux décrivent des comportements observés par les formateurs pendant les sessions du programme, à un moment donné. Ils ne constituent
            ni un diagnostic, ni une certification, ni une mesure de la valeur d’une personne.
          </Text>

          {passport.frameworks.map((framework) => (
            <View key={framework.code}>
              <Text style={s.h2}>{framework.name}</Text>
              <Text style={s.note}>
                Échelle de {framework.rules.scaleMin} à {framework.rules.scaleMax} : {framework.levels.map((level) => `${level.value} ${level.label}`).join(' · ')}.
                {framework.isProvisional ? ' Référentiel en cours de validation.' : ''}
              </Text>
              {framework.categories.map((category) => (
                <View key={category.code} wrap={false}>
                  <Text style={s.category}>{category.name}</Text>
                  {category.skills.map((skill) => (
                    <SkillRow key={skill.code} skill={skill} framework={framework} />
                  ))}
                </View>
              ))}
              {!framework.highlights.insufficient ? (
                <View style={s.highlightBox} wrap={false}>
                  <View style={s.highlight}>
                    <Text style={s.highlightTitle}>Points forts</Text>
                    <Text>{names(framework, framework.highlights.strengths.map((h) => h.skillCode)) || '—'}</Text>
                  </View>
                  <View style={s.highlight}>
                    <Text style={s.highlightTitle}>Pistes de progression</Text>
                    <Text>{names(framework, framework.highlights.toDevelop.map((h) => h.skillCode)) || '—'}</Text>
                  </View>
                  <View style={s.highlight}>
                    <Text style={s.highlightTitle}>Évolutions</Text>
                    <Text>{names(framework, framework.highlights.progressions.map((h) => h.skillCode)) || 'Pas encore mesurable'}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          ))}

          {passport.selfAssessment?.status === 'completed' ? (
            <View wrap={false}>
              <Text style={s.h2}>Auto-évaluation initiale</Text>
              <Text style={s.note}>
                Complétée le {formatDate(passport.selfAssessment.completedAt)}. Réponses de {passport.selfAssessment.scaleMin} (
                {passport.selfAssessment.scaleLabels[0]?.label.toLowerCase()}) à {passport.selfAssessment.scaleMax} (
                {passport.selfAssessment.scaleLabels.at(-1)?.label.toLowerCase()}).
              </Text>
              {passport.selfAssessment.answers.map((answer) => (
                <View key={answer.questionId} style={s.row}>
                  <Text style={{ flex: 1, fontSize: 8.5 }}>{answer.text}</Text>
                  <View style={{ width: 110, flexDirection: 'row' }}>
                    <Meter value={answer.value} min={passport.selfAssessment!.scaleMin} max={passport.selfAssessment!.scaleMax} color={C.self} track={C.selfLight} />
                  </View>
                  <Text style={{ width: 20, fontSize: 8.5, textAlign: 'right' }}>{answer.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {feedback.length > 0 ? (
            <View>
              <Text style={s.h2}>Retours des formateurs</Text>
              {feedback.map((evaluation) => (
                <View key={evaluation.id} style={s.feedback} wrap={false}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>
                    Session {evaluation.sessionNumber} · {evaluation.sessionTitle} · {formatDate(evaluation.date)}
                  </Text>
                  {evaluation.observation ? <Text>{evaluation.observation}</Text> : null}
                  {evaluation.advice ? <Text style={{ color: C.muted }}>Conseil : {evaluation.advice}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={s.footer} fixed>
          <Text>
            Passeport généré le {formatDate(generatedAt)} · HAPPI Compétence — L’avenir se joue ici.
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
