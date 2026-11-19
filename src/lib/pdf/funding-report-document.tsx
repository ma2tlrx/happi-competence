import { join } from 'node:path';

import { Document, Image, Page, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';

import { TRAINING_ORGANISATION } from '@/lib/attendance/documents';
import { formatHours } from '@/lib/attendance/hours';
import type { ConventionReport } from '@/lib/funding/indicators';
import { conventionStatusLabel, FUNDING_REPORT_NOTICE, funderKindLabel } from '@/lib/funding/labels';
import { formatRatio, type Ratio } from '@/lib/outcomes/impact';
import {
  DROP_REASON_CODES,
  DROP_REASONS,
  NOT_RECORDED,
  OUTCOME_KIND_CODES,
  OUTCOME_KINDS,
  OUTCOME_SITUATION_CODES,
  OUTCOME_SITUATIONS,
  PROVISIONAL_OUTCOMES_NOTICE,
  situationLabel,
} from '@/lib/outcomes/labels';
import { AUDIENCE_LABELS, MOMENT_LABELS } from '@/lib/satisfaction/window';
import { formatDate, formatDateTime } from '@/lib/utils';

import { C, registerReportFonts } from './report/theme';

export type FundingReportConvention = {
  reference: string | null;
  title: string;
  funderName: string;
  funderKind: string;
  startDate: string;
  endDate: string;
  plannedParticipants: number;
  plannedHours: number;
  status: string;
};

const cell = { paddingVertical: 3.5, paddingHorizontal: 5 };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 14 }}>
      <View wrap={false} minPresenceAhead={60}>
        <Text style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 12, color: C.petrol, marginBottom: 6 }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Line({ title, value }: { title: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 3 }} wrap={false}>
      <Text style={{ width: 190, color: C.muted }}>{title}</Text>
      <Text style={{ flex: 1, fontWeight: 700 }}>{value}</Text>
    </View>
  );
}

function Grid({ columns, rows }: { columns: { label: string; width: string }[]; rows: string[][] }) {
  return (
    <View style={{ borderTopWidth: 1, borderColor: C.lineStrong }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.petrol50, borderBottomWidth: 1, borderColor: C.lineStrong, fontWeight: 700 }} wrap={false}>
        {columns.map((column) => (
          <Text key={column.label} style={[cell, { width: column.width }]}>
            {column.label}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View key={index} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: C.line }} wrap={false}>
          {row.map((value, column) => (
            <Text key={column} style={[cell, { width: columns[column]!.width }]}>
              {value}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: 8, color: C.muted, marginTop: 4 }}>{children}</Text>;
}

const pct = (value: Ratio) => formatRatio(value);
const hoursRate = (value: Ratio) => (value.rate === null ? '—' : `${Math.round(value.rate)} %`);

/**
 * Bilan de l'action d'une convention de financement (modèle indicatif). Données agrégées ;
 * l'annexe nominative (nom, heures réalisées, situation de sortie) n'est ajoutée que sur
 * demande explicite.
 */
export function FundingReportDocument({
  convention,
  report,
  nominative = false,
  generatedAt,
  root = process.cwd(),
}: {
  convention: FundingReportConvention;
  report: ConventionReport;
  nominative?: boolean;
  generatedAt: Date;
  root?: string;
}) {
  registerReportFonts(root);
  const { participants, hours, indicators } = report;
  const title = convention.reference ? `${convention.title} (${convention.reference})` : convention.title;
  return (
    <Document title={`Bilan de l’action — ${title}`} author={TRAINING_ORGANISATION.name} language="fr-FR">
      <Page size="A4" style={{ paddingTop: 40, paddingBottom: 60, paddingHorizontal: 44, fontFamily: 'DM Sans', fontSize: 9, lineHeight: 1.4, color: C.ink }}>
        <View style={{ position: 'absolute', bottom: 22, left: 44, right: 44, fontSize: 7, color: C.subtle }} fixed>
          <Text>{`Généré le ${formatDateTime(generatedAt)} · ${TRAINING_ORGANISATION.name} · ${FUNDING_REPORT_NOTICE}`}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 8.5, color: C.orange700, letterSpacing: 1.2 }}>MODÈLE INDICATIF</Text>
            <Text style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 20, lineHeight: 1.2, color: C.petrol, marginTop: 2 }}>Bilan de l’action</Text>
            <Text style={{ fontSize: 10.5, marginTop: 4 }}>{title}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, pas d'attribut alt */}
          <Image src={join(root, 'public', 'brand', 'happi-logotype-petrole.png')} style={{ width: 86, height: 33 }} />
        </View>
        <View style={{ marginTop: 10, borderLeftWidth: 2, borderColor: C.orange, paddingLeft: 8 }}>
          <Text style={{ fontWeight: 700, color: C.orange700 }}>{FUNDING_REPORT_NOTICE}</Text>
        </View>

        <Section title="1. Identification de l’action">
          <View style={{ backgroundColor: C.paper, borderRadius: 4, padding: 10 }}>
            <Line title="Intitulé" value={convention.title} />
            <Line title="Référence de la convention ou du marché" value={convention.reference ?? 'Non renseignée'} />
            <Line title="Financeur" value={`${convention.funderName} — ${funderKindLabel(convention.funderKind)}`} />
            <Line title="Période conventionnée" value={`du ${formatDate(convention.startDate)} au ${formatDate(convention.endDate)}`} />
            <Line title="Statut de la convention" value={conventionStatusLabel(convention.status)} />
            <Line title="Organisme de formation" value={`${TRAINING_ORGANISATION.name} — ${TRAINING_ORGANISATION.legal}`} />
          </View>
          {report.groups.length ? (
            <View style={{ marginTop: 6 }}>
              <Grid
                columns={[
                  { label: 'Groupe', width: '40%' },
                  { label: 'Dates', width: '30%' },
                  { label: 'Parcours', width: '15%' },
                  { label: 'Séances réalisées', width: '15%' },
                ]}
                rows={report.groups.map((group) => [
                  group.name,
                  `${formatDate(group.startDate, '—')} – ${formatDate(group.endDate, '—')}`,
                  String(group.enrolled),
                  String(group.sessionsCompleted),
                ])}
              />
            </View>
          ) : (
            <Muted>Aucun groupe rattaché à cette convention.</Muted>
          )}
        </Section>

        <Section title="2. Public accueilli">
          <Line title="Participants conventionnés" value={String(participants.planned)} />
          <Line title="Parcours entrés" value={`${participants.entered} (${pct(participants.entryRate)} des conventionnés)`} />
          <Line title="Personnes distinctes" value={String(participants.distinct)} />
          <Line title="Parcours en cours ou terminés" value={String(indicators.active)} />
          <Line title="Abandons" value={`${indicators.dropped} — ${pct(indicators.dropRate)}`} />
          <Muted>Un parcours = un participant inscrit dans un groupe. Les inscriptions retirées pour erreur ne sont pas comptées.</Muted>
        </Section>

        <Section title="3. Réalisation">
          <Line title="Heures-stagiaires conventionnées" value={`${formatHours(hours.conventionMinutes)} (${participants.planned} × ${String(convention.plannedHours).replace('.', ',')} h)`} />
          <Line title="Heures-stagiaires planifiées" value={formatHours(hours.scheduledMinutes)} />
          <Line title="Heures-stagiaires réalisées" value={formatHours(hours.realisedMinutes)} />
          <Line title="Réalisé / conventionné" value={hoursRate(hours.realisationRate)} />
          <Line title="Réalisé / planifié" value={hoursRate(hours.scheduleRate)} />
          <Line title="Moyenne réalisée par parcours" value={hours.averageRealisedMinutes === null ? '—' : formatHours(hours.averageRealisedMinutes)} />
          <Line title="Assiduité (séances terminées)" value={pct(indicators.attendance)} />
          <Line title="Présences non saisies" value={String(hours.missingAttendance)} />
          <Muted>
            Heures réalisées : règle du certificat de réalisation (séance terminée, participant présent, en retard ou parti plus tôt : séance comptée en entier ;
            durée selon les horaires, sinon la trame du programme, sinon 3 h). Une présence non saisie n’est ni une absence ni une heure réalisée.
            {hours.sessionsWithoutTimes ? ` ${hours.sessionsWithoutTimes} séance(s) sans horaires : durée de la trame.` : ''}
            {hours.sessionsOutsidePeriod ? ` ${hours.sessionsOutsidePeriod} séance(s) terminée(s) hors de la période conventionnée ou sans date : à vérifier.` : ''}
          </Muted>
        </Section>

        <Section title="4. Abandons par motif">
          {indicators.dropped ? (
            <Grid
              columns={[
                { label: 'Motif', width: '70%' },
                { label: 'Nombre', width: '30%' },
              ]}
              rows={DROP_REASON_CODES.filter((code) => indicators.dropReasons[code] > 0).map((code) => [DROP_REASONS[code], String(indicators.dropReasons[code])])}
            />
          ) : (
            <Muted>Aucun abandon enregistré.</Muted>
          )}
        </Section>

        <Section title="5. Résultats">
          <Line
            title="Progression observée"
            value={`${pct(indicators.progression)} — ${indicators.progression.insufficient} parcours non évaluable(s)`}
          />
          <Grid
            columns={[
              { label: 'Moment', width: '22%' },
              { label: 'Attendues', width: '13%' },
              { label: 'Renseignées', width: '15%' },
              { label: NOT_RECORDED, width: '15%' },
              { label: 'Répartition des situations renseignées', width: '35%' },
            ]}
            rows={OUTCOME_KIND_CODES.map((kind) => {
              const outcome = indicators.outcomes[kind];
              const split = OUTCOME_SITUATION_CODES.filter((code) => outcome.bySituation[code] > 0)
                .map((code) => `${OUTCOME_SITUATIONS[code].label} : ${outcome.bySituation[code]}`)
                .join(' · ');
              return [OUTCOME_KINDS[kind], String(outcome.expected), String(outcome.recorded), String(outcome.missing), split || '—'];
            })}
          />
          <Muted>
            Progression : au moins une compétence observée sur deux séances, avec un niveau final supérieur au premier. Une situation est attendue à son
            échéance (sortie, 3 mois, 6 mois) ; les situations non renseignées restent à part et ne sont rangées dans aucune catégorie. {PROVISIONAL_OUTCOMES_NOTICE}
          </Muted>
        </Section>

        <Section title="6. Satisfaction">
          {report.satisfaction.some((block) => block.invited > 0) ? (
            report.satisfaction
              .filter((block) => block.invited > 0)
              .map((block) => (
                <View key={`${block.audience}-${block.moment}`} style={{ marginBottom: 6 }} wrap={false}>
                  <Line
                    title={`${AUDIENCE_LABELS[block.audience]} — ${MOMENT_LABELS[block.moment].label}`}
                    value={`${block.responses} réponse(s) sur ${block.invited} invité(s) — taux de réponse ${pct(block.responseRate)}`}
                  />
                  {block.scores.map((score) => (
                    <Text key={score.text} style={{ marginLeft: 12, color: C.muted }}>
                      {`• ${score.text} : ${
                        score.kind === 'nps'
                          ? `indice de recommandation ${score.recommendationIndex ?? '—'}`
                          : `moyenne ${score.mean === null ? '—' : String(score.mean).replace('.', ',')} / 5`
                      } (n = ${score.n})`}
                    </Text>
                  ))}
                </View>
              ))
          ) : (
            <Muted>Aucune enquête de satisfaction ouverte pour les groupes de cette convention.</Muted>
          )}
        </Section>

        <Section title="7. Pièces justificatives disponibles">
          <Line title="Feuilles d’émargement (séances terminées)" value={`${report.evidence.sheets.length}, dont ${report.evidence.countersignedSheets} contre-signée(s)`} />
          <Line title="Certificats de réalisation" value={`${report.evidence.certificates} (un par parcours ayant au moins une séance suivie)`} />
          {report.evidence.sheets.length ? (
            <Grid
              columns={[
                { label: 'Groupe', width: '45%' },
                { label: 'Séance', width: '12%' },
                { label: 'Date', width: '23%' },
                { label: 'Contre-signée', width: '20%' },
              ]}
              rows={report.evidence.sheets.map((sheet) => [sheet.groupName, String(sheet.number), formatDate(sheet.date, '—'), sheet.countersigned ? 'Oui' : 'Non'])}
            />
          ) : null}
          <Muted>Feuilles et certificats se téléchargent depuis la fiche de chaque séance et de chaque participant (PDF avec empreinte SHA-256).</Muted>
        </Section>

        {nominative ? (
          <View break>
            <Text style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 12, color: C.petrol, marginBottom: 4 }}>Annexe nominative</Text>
            <Muted>Données personnelles : à ne transmettre qu’au financeur qui les exige, par un canal sécurisé.</Muted>
            <View style={{ marginTop: 6 }}>
              <Grid
                columns={[
                  { label: 'Nom', width: '22%' },
                  { label: 'Prénom', width: '18%' },
                  { label: 'Groupe', width: '22%' },
                  { label: 'Heures réalisées', width: '14%' },
                  { label: 'Situation de sortie', width: '24%' },
                ]}
                rows={report.rows.map((row) => [
                  row.lastName.toUpperCase(),
                  row.firstName,
                  row.groupName,
                  formatHours(row.realisedMinutes),
                  row.outcomes.exit === undefined ? 'Pas encore attendue' : situationLabel(row.outcomes.exit),
                ])}
              />
            </View>
          </View>
        ) : null}

      </Page>
    </Document>
  );
}
