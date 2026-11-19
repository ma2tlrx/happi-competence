import { Bot, Eye, GitBranch, Layers, ListChecks, Scale, Users } from 'lucide-react';
import type { Metadata } from 'next';

import { Reveal } from '@/components/public/reveal';
import { PageHero, Section, SectionHeading } from '@/components/public/sections';
import { formatCoefficient, formatCoefficientInterval, formatRate, formatRateInterval, INSUFFICIENT } from '@/lib/reliability/format';
import { getPublicReliability } from '@/lib/reliability/public';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Notre méthode',
  description: 'Comment les compétences sont observées dans HAPPI : référentiels versionnés, niveaux décrits, plusieurs séances, IA sous contrôle humain, seconde cotation.',
};

// Uniquement des faits vérifiables dans l'application (voir docs/fiabilite.md, docs/bilans.md).
const STEPS = [
  {
    icon: GitBranch,
    title: 'Des référentiels versionnés',
    text: 'Chaque référentiel de compétences a des versions numérotées. Une version publiée ne se modifie plus : toute évolution passe par une nouvelle version. Chaque évaluation garde la version qui a servi, et une version en attente de validation pédagogique est signalée comme provisoire.',
  },
  {
    icon: ListChecks,
    title: 'Des niveaux décrits',
    text: 'L’échelle de chaque version est fixée à l’avance. Chaque niveau porte un libellé et, pour chaque compétence, une description de ce qui est attendu, avec des critères d’observation. Le formateur choisit le niveau qui correspond à ce qu’il a vu.',
  },
  {
    icon: Eye,
    title: 'Ce qui n’est pas observé n’est pas noté',
    text: 'Une compétence qui n’a pas pu être observée reste « non observée » : elle n’est jamais comptée comme un zéro.',
  },
  {
    icon: Layers,
    title: 'Plusieurs séances',
    text: 'Le programme compte plusieurs séances, et chaque séance cible des compétences définies à l’avance. Le passeport rassemble les observations validées de séance en séance, selon la règle de synthèse fixée par la version du référentiel.',
  },
  {
    icon: Users,
    title: 'Une évaluation validée et tracée',
    text: 'L’évaluation d’une séance est validée explicitement par le formateur. Toute correction ultérieure exige un motif et reste tracée : auteur, date, ancienne et nouvelle valeur. L’auto-évaluation du participant est conservée à part : les deux regards sont comparés, jamais confondus.',
  },
  {
    icon: Bot,
    title: 'L’IA sous contrôle humain',
    text: 'L’IA peut aider à structurer les notes d’un formateur et proposer une rédaction du bilan. Elle ne saisit aucun niveau et ne valide rien : le formateur relit, corrige et valide.',
  },
  {
    icon: Scale,
    title: 'Une seconde cotation à l’aveugle',
    text: 'Un autre formateur peut coter les mêmes participants sans voir l’évaluation officielle, jusqu’à ce qu’il ait soumis sa cotation. Ces secondes cotations ne comptent ni dans le passeport ni dans le bilan : elles servent à mesurer l’accord entre formateurs et à organiser des séances d’étalonnage.',
  },
];

export default async function MethodPage() {
  const reliability = await getPublicReliability();
  return (
    <>
      <PageHero
        title="Notre méthode"
        intro="Comment les compétences sont observées, notées et vérifiées dans HAPPI. Un niveau décrit ce qu’un formateur a observé, à un moment donné, dans une situation de jeu : ce n’est ni un test psychométrique, ni une certification."
      />
      <Section tone="white">
        <SectionHeading title="L’observation, étape par étape" />
        <div className="mt-10 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delay={(index % 3) * 0.06}>
              <step.icon className="size-6 text-orange-600" aria-hidden />
              <h3 className="mt-4 text-title">{step.title}</h3>
              <p className="mt-2 text-ink-muted">{step.text}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {reliability ? (
        <Section>
          <SectionHeading
            title="Accord entre formateurs"
            intro={`Comparaison entre l’évaluation officielle et les secondes cotations à l’aveugle, calculée le ${formatDate(reliability.computedAt)}. Chaque valeur est donnée avec son effectif (n, nombre de compétences cotées par les deux formateurs) et un intervalle de confiance à 95 %.`}
          />
          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {reliability.rows.map((row) => (
              <li key={`${row.framework}-${row.version}`} className="rounded-lg border border-line bg-white p-5">
                <h3 className="text-base font-semibold">{row.framework}</h3>
                <p className="text-sm text-ink-subtle">{row.version} · n = {row.n}</p>
                {row.sufficient && row.exact && row.adjacent && row.kappa ? (
                  <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <dt className="text-sm text-ink-muted">Accord exact</dt>
                      <dd className="font-display text-2xl font-semibold text-petrol-900">{formatRate(row.exact.rate)}</dd>
                      <dd className="text-xs text-ink-subtle">IC 95 % {formatRateInterval(row.exact.ci)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-ink-muted">À un niveau près</dt>
                      <dd className="font-display text-2xl font-semibold text-petrol-900">{formatRate(row.adjacent.rate)}</dd>
                      <dd className="text-xs text-ink-subtle">IC 95 % {formatRateInterval(row.adjacent.ci)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-ink-muted">Kappa pondéré</dt>
                      <dd className="font-display text-2xl font-semibold text-petrol-900">{formatCoefficient(row.kappa.value)}</dd>
                      <dd className="text-xs text-ink-subtle">IC 95 % {formatCoefficientInterval(row.kappa.ci)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-4 font-semibold text-ink-muted">{INSUFFICIENT} (moins de {reliability.minPairs} paires).</p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl text-sm text-ink-muted">
            Ces chiffres décrivent la cohérence entre formateurs sur les données de la plateforme ; ils ne constituent pas une étude de validité. Les intervalles supposent des cotations
            indépendantes, alors que plusieurs compétences d’un même participant sont comptées : l’incertitude réelle est plus grande.
          </p>
        </Section>
      ) : null}
    </>
  );
}
