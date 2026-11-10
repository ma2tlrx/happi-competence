import type { Metadata } from 'next';

import { Reveal } from '@/components/public/reveal';
import { PageHero, Section } from '@/components/public/sections';
import { LevelMeter } from '@/components/ui/level-meter';
import { Notice, ProvisionalBadge } from '@/components/ui/primitives';
import { getPublicCatalog } from '@/lib/public-catalog';

export const metadata: Metadata = {
  title: 'Les compétences',
  description: 'Les 18 compétences transversales et les 16 habiletés socio-cognitives observées dans le programme HAPPI.',
};

export default async function CompetencesPage() {
  const { frameworks } = await getPublicCatalog();
  return (
    <>
      <PageHero
        title="Les compétences observées"
        intro="Deux référentiels complémentaires, organisés en catégories. Chacun possède son échelle de niveaux : elle décrit ce qui a été observé, pas la valeur d’une personne."
      >
        <nav aria-label="Référentiels" className="mt-8 flex flex-wrap gap-3">
          {frameworks.map((framework) => (
            <a key={framework.code} href={`#${framework.code}`} className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
              {framework.name}
            </a>
          ))}
        </nav>
      </PageHero>

      {frameworks.length === 0 ? (
        <Section>
          <Notice title="Référentiels indisponibles">Les référentiels n’ont pas pu être chargés. Réessayez dans un instant.</Notice>
        </Section>
      ) : null}

      {frameworks.map((framework, frameworkIndex) => (
        <Section key={framework.code} id={framework.code} tone={frameworkIndex % 2 === 0 ? 'white' : 'paper'} className="scroll-mt-16">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-display-lg">{framework.name}</h2>
              {framework.is_provisional ? <ProvisionalBadge>Référentiel en cours de validation</ProvisionalBadge> : null}
            </div>
            {framework.description ? <p className="mt-4 text-lead text-ink-muted">{framework.description}</p> : null}
          </div>

          <div className="mt-8 rounded-xl border border-line bg-white p-5 sm:p-6">
            <p className="text-sm font-semibold text-ink">
              Échelle de {framework.scale_min} à {framework.scale_max}
            </p>
            <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {framework.levels.map((level) => (
                <li key={level.value}>
                  <LevelMeter value={level.value} min={framework.scale_min} max={framework.scale_max} size="sm" label={`Niveau ${level.value} : ${level.label}`} />
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">{level.value}</span> · {level.label}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-12 space-y-12">
            {framework.categories.map((category) => (
              <Reveal key={category.code}>
                <h3 className="text-display-md">{category.name}</h3>
                {category.description ? <p className="mt-2 max-w-2xl text-ink-muted">{category.description}</p> : null}
                <ul className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {category.skills.map((skill) => (
                    <li key={skill.code} className="rounded-lg border border-line bg-white p-5">
                      <p className="font-display font-semibold">{skill.name}</p>
                      <p className="mt-1.5 text-[0.9375rem] text-ink-muted">{skill.description ?? 'Description détaillée à venir avec le référentiel officiel.'}</p>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
