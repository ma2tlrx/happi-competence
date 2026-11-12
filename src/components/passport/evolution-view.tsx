import { TrendingUp } from 'lucide-react';

import { Card, CardBody, CardHeader, EmptyState, Notice, ProvisionalBadge, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { DECLARED_CHANGE_LABELS, TREND_LABELS, type DeclaredAnswer, type Evolution, type EvolutionSkill } from '@/lib/evolution';
import { formatDate, formatScore } from '@/lib/utils';

function Declared({ answer, empty }: { answer: DeclaredAnswer | null; empty: string }) {
  if (!answer) return <span className="text-ink-subtle">{empty}</span>;
  return (
    <span>
      <span className="font-semibold text-ink tabular-nums">{answer.value}</span>
      {answer.label ? <span className="text-ink-muted"> · {answer.label}</span> : null}
    </span>
  );
}

function Observed({ skill }: { skill: EvolutionSkill }) {
  const observed = skill.observed;
  if (!observed) return <span className="text-ink-subtle">Non observée</span>;
  return (
    <span className="block">
      <span>
        <span className="font-semibold text-ink">Niveau {formatScore(observed.last.value)}</span>
        {observed.last.label ? <span className="text-ink-muted"> · {observed.last.label}</span> : null}
        <span className="text-sm text-ink-subtle"> (séance {observed.last.session})</span>
      </span>
      {observed.count > 1 ? (
        <span className="mt-0.5 block text-sm text-ink-subtle">
          1re observation : niveau {formatScore(observed.first.value)}
          {observed.first.label ? ` · ${observed.first.label}` : ''} (séance {observed.first.session}) · {observed.count} observations
          {observed.trend ? <span className="sr-only">. {TREND_LABELS[observed.trend]}</span> : null}
        </span>
      ) : (
        <span className="mt-0.5 block text-sm text-ink-subtle">1 observation</span>
      )}
    </span>
  );
}

/**
 * « Mon évolution » : déclaré au départ, observé par les formateurs, déclaré à la fin, côte à
 * côte. Aucune addition ni comparaison chiffrée entre échelles différentes ; formulations neutres.
 */
export function EvolutionView({ evolution, audience = 'participant' }: { evolution: Evolution; audience?: 'participant' | 'pro' }) {
  const you = audience === 'participant';
  if (!evolution.hasData) {
    return (
      <Card>
        <EmptyState
          icon={TrendingUp}
          title="L’évolution se construit au fil du parcours"
          description={`Elle rassemble ${you ? 'votre' : 'l’'}auto-évaluation de départ, les observations validées des formateurs et l’auto-évaluation de fin de parcours.`}
        />
      </Card>
    );
  }
  const questionnaire = evolution.questionnaire;
  return (
    <div className="space-y-6">
      <Notice title="Comment lire ce tableau">
        Trois regards différents, présentés côte à côte : {you ? 'vos réponses' : 'les réponses du participant'} au questionnaire au début et à la fin du parcours
        {questionnaire ? ` (échelle de ${questionnaire.scaleMin} à ${questionnaire.scaleMax} : ${questionnaire.labels.map((level) => `${level.value} = ${level.label}`).join(', ')})` : ''}, et le
        niveau observé par les formateurs sur l’échelle du référentiel. Ces échelles ne mesurent pas la même chose : elles ne s’additionnent pas et ne se comparent pas
        entre elles. « Non observée » signifie qu’aucune observation n’a été validée, pas un niveau nul.
      </Notice>
      <p className="text-sm text-ink-muted">
        Auto-évaluation de départ : {evolution.initialCompletedAt ? `complétée le ${formatDate(evolution.initialCompletedAt)}` : 'non complétée'} · auto-évaluation de fin :{' '}
        {evolution.finalCompletedAt
          ? `complétée le ${formatDate(evolution.finalCompletedAt)}`
          : evolution.finalStatus === 'open' || evolution.finalStatus === 'in_progress'
            ? 'ouverte, pas encore terminée'
            : 'proposée en fin de parcours'}
      </p>
      {evolution.frameworks
        .filter((framework) => framework.skills.length > 0)
        .map((framework) => (
          <Card key={framework.code}>
            <CardHeader
              title={<span className="flex flex-wrap items-center gap-2">{framework.name}{framework.isProvisional ? <ProvisionalBadge /> : null}</span>}
              description={`Niveaux observés de ${framework.scaleMin} à ${framework.scaleMax} : ${framework.levels.map((level) => `${level.value} = ${level.label}`).join(', ')}`}
            />
            <CardBody className="px-0 pt-3 pb-1 sm:px-0">
              <TableWrap label={`Évolution · ${framework.name}`}>
                <Table>
                  <thead>
                    <tr>
                      <Th>Compétence</Th>
                      <Th>Déclaré au départ</Th>
                      <Th>Observé par les formateurs</Th>
                      <Th>Déclaré à la fin</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {framework.skills.map((skill) => (
                      <Tr key={skill.code}>
                        <Td className="min-w-40 font-medium">{skill.name}</Td>
                        <Td className="min-w-36">
                          <Declared answer={skill.initial} empty={evolution.initialCompletedAt ? 'Pas de question' : 'Non renseigné'} />
                        </Td>
                        <Td className="min-w-52">
                          <Observed skill={skill} />
                        </Td>
                        <Td className="min-w-36">
                          <Declared answer={skill.final} empty={evolution.finalCompletedAt ? 'Pas de question' : 'À venir'} />
                          {skill.declaredChange ? <span className="mt-0.5 block text-sm text-ink-subtle">{DECLARED_CHANGE_LABELS[skill.declaredChange]}</span> : null}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
              {framework.omitted > 0 ? (
                <p className="px-5 py-3 text-sm text-ink-subtle sm:px-6">
                  {framework.omitted} compétence{framework.omitted > 1 ? 's' : ''} sans question au questionnaire ni observation validée {framework.omitted > 1 ? 'ne sont' : 'n’est'} pas
                  {framework.omitted > 1 ? ' présentées' : ' présentée'}.
                </p>
              ) : null}
            </CardBody>
          </Card>
        ))}
    </div>
  );
}
