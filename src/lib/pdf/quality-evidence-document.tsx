import { join } from 'node:path';

import { Document, Image, Page, Text, View } from '@react-pdf/renderer';

import { TRAINING_ORGANISATION } from '@/lib/attendance/documents';
import { complaintDelay, formatRate } from '@/lib/quality/indicators';
import {
  ACTION_ORIGINS,
  ACTION_STATUSES,
  COMPLAINT_CHANNELS,
  COMPLAINT_SOURCES,
  COMPLAINT_STATUSES,
  QUALIFICATION_KINDS,
  QUALIOPI_DISCLAIMER,
  QUALIOPI_HINTS,
  QUALIOPI_NUMBERING_NOTE,
  SATISFACTION_RATE_DEFINITION,
  WATCH_KINDS,
} from '@/lib/quality/labels';
import type { ComplaintRecord, ImprovementAction, QualityDashboard, TrainerRegistry, WatchEntry } from '@/lib/quality/load';
import { formatDate, formatDateTime } from '@/lib/utils';

import { C, registerReportFonts, s } from './report/theme';

export type QualityEvidence = {
  dashboard: QualityDashboard;
  complaints: ComplaintRecord[];
  actions: ImprovementAction[];
  watch: WatchEntry[];
  registry: TrainerRegistry[];
};

const label = (labels: Record<string, string | { label: string }>, code: string) => {
  const value = labels[code];
  return value === undefined ? code : typeof value === 'string' ? value : value.label;
};
const percent = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate)} %`);
const cell = { paddingVertical: 3, paddingHorizontal: 4 };

type Column = { title: string; width: string };

function TableBlock({ columns, rows, empty }: { columns: Column[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <Text style={{ color: C.muted }}>{empty}</Text>;
  return (
    <View style={{ borderTopWidth: 1, borderColor: C.lineStrong, fontSize: 8 }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.petrol50, borderBottomWidth: 1, borderColor: C.lineStrong, fontWeight: 700 }} fixed>
        {columns.map((column) => (
          <Text key={column.title} style={[cell, { width: column.width }]}>
            {column.title}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View key={index} style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderColor: C.line }} wrap={false}>
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

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.h2} minPresenceAhead={60}>
        {title}
      </Text>
      {hint ? <Text style={{ fontSize: 7.5, color: C.subtle, marginTop: -4, marginBottom: 6 }}>{`${hint} — ${QUALIOPI_DISCLAIMER}`}</Text> : null}
      {children}
    </View>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
      <Text style={{ width: 190, color: C.muted }}>{title}</Text>
      <Text style={{ flex: 1, fontWeight: 700 }}>{value}</Text>
    </View>
  );
}

/**
 * Dossier de preuves qualité d'une période : synthèse des indicateurs et registres
 * (réclamations, plan d'amélioration, intervenants, veille). L'analyse du besoin n'y figure
 * qu'en effectifs : les fiches nominatives restent consultables dans la plateforme.
 */
export function QualityEvidenceDocument({ evidence, generatedAt, root = process.cwd() }: { evidence: QualityEvidence; generatedAt: Date; root?: string }) {
  registerReportFonts(root);
  const { dashboard, complaints, actions, watch, registry } = evidence;
  const { snapshot, period } = dashboard;
  const periodLabel = `du ${formatDate(period.from)} au ${formatDate(period.to)}`;
  return (
    <Document title={`Dossier de preuves qualité — ${periodLabel}`} author={TRAINING_ORGANISATION.name} language="fr-FR">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <Text>{`${TRAINING_ORGANISATION.name} · Dossier de preuves qualité`}</Text>
          <Text>{periodLabel}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={s.kicker}>DOSSIER DE PREUVES</Text>
            <Text style={s.h1}>Registres et indicateurs qualité</Text>
            <Text style={s.lead}>{`Période ${periodLabel}. Données extraites de la plateforme HAPPI Compétence le ${formatDateTime(generatedAt)}.`}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, pas d'attribut alt */}
          <Image src={join(root, 'public', 'brand', 'happi-logotype-petrole.png')} style={{ width: 86, height: 33 }} />
        </View>
        <View style={{ marginTop: 12, borderLeftWidth: 2, borderColor: C.orange, paddingLeft: 10 }}>
          <Text style={{ fontWeight: 700, color: C.orange700 }}>{QUALIOPI_DISCLAIMER}</Text>
          <Text style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>{QUALIOPI_NUMBERING_NOTE}</Text>
        </View>

        <Section title="Synthèse des indicateurs">
          <Metric
            title="Satisfaction des participants (à chaud)"
            value={`${percent(snapshot.satisfaction.rate)} · ${snapshot.satisfaction.count} notes 4–5 sur ${snapshot.satisfaction.n} · ${snapshot.satisfaction.respondents} répondant(s)`}
          />
          <Metric title="Taux d’abandon" value={`${formatRate(snapshot.impact.dropRate)} · ${snapshot.impact.dropped} abandon(s)`} />
          <Metric title="Assiduité" value={formatRate(snapshot.impact.attendance)} />
          <Metric
            title="Réclamations"
            value={`${dashboard.complaints.total} reçue(s) · ${dashboard.complaints.open} en cours · délai moyen ${dashboard.complaints.meanDelayDays === null ? '—' : `${String(dashboard.complaints.meanDelayDays).replace('.', ',')} j`} (n = ${dashboard.complaints.answered})`}
          />
          <Metric
            title="Actions d’amélioration"
            value={`${dashboard.actions.open} ouverte(s) · ${dashboard.actions.closed} close(s) · ${dashboard.actions.overdue} en retard · efficacité constatée ${formatRate(dashboard.actions.effectivenessRecorded)}`}
          />
          <Metric
            title="Intervenants formés récemment"
            value={`${dashboard.trainers.upToDate} sur ${dashboard.trainers.total} (formation de moins de ${dashboard.trainers.maxAgeMonths} mois) · ${dashboard.trainers.aiTrained} formé(s) à l’usage de l’IA`}
          />
          <Metric
            title="Analyse du besoin renseignée"
            value={`${formatRate(dashboard.needs)} · ${dashboard.needs.adaptation} participant(s) avec adaptation prévue`}
          />
          <Text style={{ fontSize: 7.5, color: C.subtle, marginTop: 4 }}>{`${SATISFACTION_RATE_DEFINITION} Chaque taux est accompagné de son effectif (n) ; « — » : aucune donnée.`}</Text>
        </Section>

        <Section title="Registre des réclamations et incidents" hint={QUALIOPI_HINTS.improvement}>
          <TableBlock
            empty="Aucune réclamation reçue sur la période."
            columns={[
              { title: 'Reçue le', width: '11%' },
              { title: 'Source / canal', width: '15%' },
              { title: 'Objet et description', width: '30%' },
              { title: 'Statut', width: '9%' },
              { title: 'Réponse apportée', width: '25%' },
              { title: 'Délai', width: '10%' },
            ]}
            rows={complaints.map((complaint) => {
              const delay = complaintDelay(complaint);
              return [
                formatDate(complaint.receivedOn),
                `${label(COMPLAINT_SOURCES, complaint.source)} · ${label(COMPLAINT_CHANNELS, complaint.channel)}`,
                `${complaint.subject} — ${complaint.description.slice(0, 400)}`,
                label(COMPLAINT_STATUSES, complaint.status),
                complaint.response ? `${complaint.response.slice(0, 400)}${complaint.respondedOn ? ` (${formatDate(complaint.respondedOn)})` : ''}` : '—',
                delay === null ? 'sans réponse' : `${delay} j`,
              ];
            })}
          />
        </Section>

        <Section title="Plan d’amélioration continue" hint={QUALIOPI_HINTS.improvement}>
          <TableBlock
            empty="Aucune action sur la période."
            columns={[
              { title: 'Action', width: '28%' },
              { title: 'Origine', width: '16%' },
              { title: 'Responsable', width: '12%' },
              { title: 'Échéance', width: '10%' },
              { title: 'Statut', width: '11%' },
              { title: 'Efficacité constatée', width: '23%' },
            ]}
            rows={actions.map((action) => [
              action.title,
              [label(ACTION_ORIGINS, action.origin), action.complaintSubject ? `« ${action.complaintSubject} »` : null, action.watchSource, action.originDetails].filter(Boolean).join(' · '),
              action.ownerName ?? '—',
              action.dueOn ? formatDate(action.dueOn) : '—',
              `${label(ACTION_STATUSES, action.status)}${action.closedOn ? ` (${formatDate(action.closedOn)})` : ''}`,
              action.effectiveness?.slice(0, 300) ?? '—',
            ])}
          />
        </Section>

        <Section title="Registre des intervenants" hint={QUALIOPI_HINTS.trainers}>
          {registry.length === 0 ? <Text style={{ color: C.muted }}>Aucun formateur.</Text> : null}
          {registry.map(({ trainer, qualifications, training }) => (
            <View key={trainer.id} style={{ marginBottom: 10 }}>
              <Text style={[s.h3, { marginBottom: 3 }]} minPresenceAhead={90}>
                {`${trainer.firstName} ${trainer.lastName}`.trim() || trainer.email}
                {trainer.status !== 'active' ? ' (compte désactivé)' : ''}
              </Text>
              <Text style={{ fontSize: 8, color: C.muted, marginBottom: 3 }}>
                {`${training.state === 'up_to_date' ? 'Formation à jour' : training.state === 'outdated' ? 'Dernière formation ancienne' : 'Aucune formation suivie datée'}${training.lastTrainingOn ? ` · dernière formation le ${formatDate(training.lastTrainingOn)}` : ''} · formation à l’IA : ${training.aiTraining ? `oui (${formatDate(training.lastAiTrainingOn)})` : 'non enregistrée'}`}
              </Text>
              <TableBlock
                empty="Registre vide."
                columns={[
                  { title: 'Type', width: '18%' },
                  { title: 'Intitulé', width: '34%' },
                  { title: 'Dates', width: '20%' },
                  { title: 'Justificatif', width: '28%' },
                ]}
                rows={qualifications.map((row) => [
                  `${label(QUALIFICATION_KINDS, row.kind)}${row.isAiTraining ? ' (IA)' : ''}`,
                  [row.title, row.provider].filter(Boolean).join(' · '),
                  `${row.startedOn ? `${formatDate(row.startedOn)} → ` : ''}${row.completedOn ? formatDate(row.completedOn) : row.startedOn ? 'en cours' : '—'}`,
                  row.evidence ?? '—',
                ])}
              />
            </View>
          ))}
        </Section>

        <Section title="Journal de veille" hint={QUALIOPI_HINTS.watch}>
          <TableBlock
            empty="Aucune entrée de veille sur la période."
            columns={[
              { title: 'Date', width: '11%' },
              { title: 'Type', width: '15%' },
              { title: 'Source et résumé', width: '34%' },
              { title: 'Impact', width: '22%' },
              { title: 'Décision', width: '18%' },
            ]}
            rows={watch.map((entry) => [
              formatDate(entry.observedOn),
              label(WATCH_KINDS, entry.kind),
              `${entry.source} — ${entry.summary.slice(0, 400)}`,
              entry.impact?.slice(0, 300) ?? '—',
              entry.decision?.slice(0, 300) ?? '—',
            ])}
          />
        </Section>

        <Section title="Analyse du besoin à l’entrée" hint={QUALIOPI_HINTS.needs}>
          <Text>
            {`${dashboard.needs.count} participant(s) sur ${dashboard.needs.n} inscrit(s) sur la période disposent d’une analyse du besoin ; ${dashboard.needs.adaptation} avec une adaptation prévue. Les fiches nominatives sont consultables sur la fiche de chaque participant dans la plateforme. Aucune donnée de santé n’est enregistrée.`}
          </Text>
        </Section>

        <View style={s.footer} fixed>
          <Text>{`Généré le ${formatDateTime(generatedAt)} · document interne, données personnelles limitées au nécessaire`}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
