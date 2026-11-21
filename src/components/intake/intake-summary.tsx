import type { ReactNode } from 'react';

import { PixelProgress } from '@/components/engagement/visuals';
import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import {
  AGE_BANDS,
  APTITUDES,
  EXPERIENCES,
  RESIDENCES,
  SECTORS,
  SITUATIONS,
  STUDY_LEVELS,
  TWO_YEAR_PLANS,
  VOLUNTEERING,
  VOLUNTEERING_FIELDS,
} from '@/lib/intake/codes';
import type { IntakeRow } from '@/lib/intake/load';
import { formatDate } from '@/lib/utils';

function label<T extends Record<string, string>>(map: T, code: string | null | undefined) {
  return code && code in map ? map[code as keyof T] : null;
}

function Line({ term, children }: { term: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <dt className="text-sm text-ink-muted">{term}</dt>
      <dd className="text-[0.9375rem] whitespace-pre-line text-ink">{children}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold text-petrol-700">{title}</h3>
      <dl className="divide-y divide-line">{children}</dl>
    </section>
  );
}

/**
 * Réponses au questionnaire d'accueil, regroupées comme dans le formulaire. Sert au participant (profil)
 * et à ses formateurs (fiche participant). Une réponse absente n'est simplement pas affichée.
 */
export function IntakeSummaryCard({ intake, title = 'Questionnaire d’accueil', action, emptyText }: { intake: IntakeRow | null; title?: string; action?: ReactNode; emptyText: string }) {
  const residence = intake ? label(RESIDENCES, intake.residence) : null;
  const aptitudes = intake ? (Object.entries(APTITUDES) as [keyof typeof APTITUDES, string][]).filter(([key]) => intake[key] !== null) : [];
  return (
    <Card>
      <CardHeader
        title={title}
        description={intake?.completed_at ? `Rempli le ${formatDate(intake.completed_at)}` : intake ? `Commencé, étape ${intake.last_step} sur 5` : undefined}
        action={action}
      />
      <CardBody className="space-y-5 pt-1">
        {!intake ? (
          <p className="text-[0.9375rem] text-ink-muted">{emptyText}</p>
        ) : (
          <>
            <Group title="Informations personnelles">
              <Line term="Âge">{label(AGE_BANDS, intake.age_band)}</Line>
              <Line term="Situation">{label(SITUATIONS, intake.situation)}</Line>
              <Line term="Ville">{residence ? [residence, intake.residence_detail].filter(Boolean).join(' · ') : null}</Line>
            </Group>
            <Group title="Parcours académique">
              <Line term="Niveau d’études">{label(STUDY_LEVELS, intake.study_level)}</Line>
              <Line term="Domaine">{intake.study_field}</Line>
              <Line term="Établissement">{intake.school}</Line>
            </Group>
            <Group title="Bénévolat & expériences">
              <Line term="Bénévolat">{label(VOLUNTEERING, intake.volunteering)}</Line>
              <Line term="Domaines">{intake.volunteering_fields.map((code) => label(VOLUNTEERING_FIELDS, code)).filter(Boolean).join(', ') || null}</Line>
              <Line term="Expérience professionnelle">{label(EXPERIENCES, intake.experience)}</Line>
              <Line term="Description">{intake.experience_detail}</Line>
            </Group>
            <Group title="Ambitions professionnelles">
              <Line term="Secteurs qui attirent">{intake.sectors.map((code) => label(SECTORS, code)).filter(Boolean).join(', ') || null}</Line>
              <Line term="Ambitions">{intake.ambitions}</Line>
              <Line term="Dans 2 ans">{label(TWO_YEAR_PLANS, intake.two_year_plan)}</Line>
            </Group>
            {aptitudes.length > 0 ? (
              <Group title="Aptitudes personnelles (auto-déclarées, de 1 à 5)">
                {aptitudes.map(([key, name]) => (
                  <Line key={key} term={name}>
                    <span className="flex items-center gap-3">
                      <PixelProgress current={intake[key] ?? 0} target={5} label={`${name} : ${intake[key]} sur 5`} className="w-28" />
                      <span className="tabular-nums">{intake[key]} / 5</span>
                    </span>
                  </Line>
                ))}
              </Group>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
