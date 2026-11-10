import { LevelMeterRow } from '@/components/ui/level-meter';
import { Card, CardBody, CardHeader, Notice } from '@/components/ui/primitives';
import { AGGREGATION_LABELS } from '@/lib/evaluation-engine';
import type { PassportFramework } from '@/lib/passport';

import { SkillCard } from './skill-card';
import { SkillRadar } from './skill-radar';

/** Ce que représente un score : affiché en tête de chaque vue de référentiel. */
export function ScaleExplanation({ framework, audience = 'participant' }: { framework: PassportFramework; audience?: 'participant' | 'pro' }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <p className="text-[0.9375rem] text-ink">
        {audience === 'participant' ? 'Vos formateurs' : 'Les formateurs'} situent chaque compétence sur une échelle de{' '}
        <strong>
          {framework.rules.scaleMin} à {framework.rules.scaleMax}
        </strong>
        , à partir de ce qu’ils ont observé pendant les sessions. Un niveau décrit une situation à un moment donné : ce n’est ni une note
        scolaire ni un jugement sur la personne.
      </p>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {framework.levels.map((level) => (
          <li key={level.value} className="flex items-center gap-2.5 text-sm">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-xs bg-petrol-900 text-xs font-semibold text-white">{level.value}</span>
            <span className="text-ink">{level.label}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-ink-subtle">
        Valeur affichée : {AGGREGATION_LABELS[framework.rules.aggregation].label.toLowerCase()}. Référentiel : {framework.versionLabel}.
      </p>
    </div>
  );
}

export function FrameworkView({
  framework,
  subRadars = false,
  audience = 'participant',
}: {
  framework: PassportFramework;
  /** Un radar par catégorie (dimensions des habiletés socio-cognitives). */
  subRadars?: boolean;
  audience?: 'participant' | 'pro';
}) {
  const { scaleMin: min, scaleMax: max } = framework.rules;
  const showSelf = framework.selfComparable;
  const radarData = framework.skills.map((skill) => ({ name: skill.name, observed: skill.summary.value, self: showSelf ? skill.selfValue : null }));

  return (
    <div className="space-y-6">
      {framework.isProvisional ? (
        <Notice variant="warning" title="Référentiel en cours de validation">
          Les intitulés et les niveaux de ce référentiel sont provisoires et seront confirmés par l’équipe HAPPI. Les observations déjà
          enregistrées restent valables.
        </Notice>
      ) : null}
      <ScaleExplanation framework={framework} audience={audience} />

      <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader
            title="Vue d’ensemble"
            description={
              framework.observedCount > 0
                ? `${framework.observedCount} compétence${framework.observedCount > 1 ? 's' : ''} observée${framework.observedCount > 1 ? 's' : ''} sur ${framework.skills.length}`
                : 'Aucune compétence observée pour le moment'
            }
          />
          <CardBody>
            <SkillRadar data={radarData} min={min} max={max} showSelf={showSelf} title={`Radar des ${framework.name.toLowerCase()}`} />
            {showSelf ? (
              <p className="mt-3 text-sm text-ink-muted">
                {audience === 'participant' ? 'Votre auto-évaluation' : 'L’auto-évaluation'} indique {audience === 'participant' ? 'votre' : 'le'} degré
                d’accord avec une affirmation (de 1, pas du tout d’accord, à 5, tout à fait d’accord). Elle est affichée à titre de comparaison : elle
                ne modifie pas les observations.
              </p>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Par catégorie" />
          <CardBody className="space-y-6">
            {framework.categories.map((category) => (
              <div key={category.code}>
                <p className="mb-2.5 text-sm font-semibold text-ink-muted">{category.name}</p>
                <div className="space-y-3">
                  {category.skills.map((skill) => (
                    <LevelMeterRow key={skill.code} name={skill.name} value={skill.summary.value} min={min} max={max} levelLabel={skill.level?.label} />
                  ))}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {subRadars ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {framework.categories.map((category) => (
            <Card key={category.code}>
              <CardHeader title={category.name} description={category.description ?? undefined} as="h3" />
              <CardBody className="pt-2">
                <SkillRadar
                  compact
                  height={240}
                  min={min}
                  max={max}
                  showSelf={false}
                  title={`Radar de la dimension ${category.name}`}
                  data={category.skills.map((skill) => ({ name: skill.name, observed: skill.summary.value, self: null }))}
                />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      {framework.categories.map((category) => (
        <section key={category.code} aria-labelledby={`categorie-${framework.code}-${category.code}`}>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
            <h3 id={`categorie-${framework.code}-${category.code}`} className="text-title">
              {category.name}
            </h3>
            {category.description ? <p className="text-sm text-ink-muted">{category.description}</p> : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {category.skills.map((skill) => (
              <SkillCard key={skill.code} skill={skill} framework={framework} showSelf={showSelf} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
