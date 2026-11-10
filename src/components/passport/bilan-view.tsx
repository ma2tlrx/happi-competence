import { ArrowUpRight, Compass, MessageSquareText, Sparkles } from 'lucide-react';

import { LevelMeter } from '@/components/ui/level-meter';
import { Card, CardBody, CardHeader, EmptyState, Notice } from '@/components/ui/primitives';
import type { Passport, PassportFramework, PassportSkill } from '@/lib/passport';
import { formatDate, formatScore } from '@/lib/utils';

function skillsFor(framework: PassportFramework, codes: string[]) {
  return codes.map((code) => framework.skills.find((skill) => skill.code === code)).filter((skill): skill is PassportSkill => Boolean(skill));
}

function SkillLine({ skill, framework, showDelta }: { skill: PassportSkill; framework: PassportFramework; showDelta?: boolean }) {
  return (
    <li>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="font-medium text-ink">{skill.name}</span>
        <span className="text-sm text-ink-muted">
          {showDelta && skill.summary.first !== null ? `${formatScore(skill.summary.first)} → ${formatScore(skill.summary.last)}` : skill.level?.label}
        </span>
      </div>
      <LevelMeter value={skill.summary.value} min={framework.rules.scaleMin} max={framework.rules.scaleMax} size="sm" label={`${skill.name} : ${formatScore(skill.summary.value)} sur ${framework.rules.scaleMax}`} />
    </li>
  );
}

/** Bilan : forces, pistes de progression, évolutions et retours des formateurs. Factuel, sans extrapolation. */
export function BilanView({ passport, audience = 'participant' }: { passport: Passport; audience?: 'participant' | 'pro' }) {
  const you = audience === 'participant';
  const anyObservation = passport.frameworks.some((framework) => framework.observedCount > 0);
  const feedback = passport.evaluations.filter((evaluation) => evaluation.observation || evaluation.advice);

  if (!anyObservation) {
    return (
      <Card>
        <EmptyState
          icon={Sparkles}
          title="Le bilan se construit au fil des sessions"
          description={`${you ? 'Vos' : 'Les'} points forts, pistes de progression et évolutions apparaîtront ici dès les premières observations validées par les formateurs.`}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Notice title="Comment lire ce bilan">
        Il résume les observations validées par les formateurs, session après session. Les « pistes de progression » désignent les compétences
        les moins observées à ce jour : ce sont des axes de travail, pas des faiblesses.
      </Notice>

      {passport.frameworks.map((framework) => {
        const { highlights } = framework;
        const strengths = skillsFor(framework, highlights.strengths.map((s) => s.skillCode));
        const toDevelop = skillsFor(framework, highlights.toDevelop.map((s) => s.skillCode));
        const progressions = skillsFor(framework, highlights.progressions.map((s) => s.skillCode));
        return (
          <section key={framework.code} aria-labelledby={`bilan-${framework.code}`}>
            <h2 id={`bilan-${framework.code}`} className="mb-3 text-title">
              {framework.name}
              <span className="ml-2 text-sm font-normal text-ink-subtle">
                {framework.observedCount}/{framework.skills.length} observées
              </span>
            </h2>
            {highlights.insufficient ? (
              <Card>
                <CardBody className="text-[0.9375rem] text-ink-muted">
                  Encore trop peu de compétences observées pour dégager des tendances. Le bilan s’enrichira après les prochaines sessions.
                </CardBody>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader as="h3" title={<span className="inline-flex items-center gap-2"><Sparkles className="size-[1.125rem] text-orange-600" aria-hidden />Points forts</span>} />
                  <CardBody>
                    <ul className="space-y-4">{strengths.map((skill) => <SkillLine key={skill.code} skill={skill} framework={framework} />)}</ul>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader as="h3" title={<span className="inline-flex items-center gap-2"><Compass className="size-[1.125rem] text-petrol-600" aria-hidden />Pistes de progression</span>} />
                  <CardBody>
                    {toDevelop.length > 0 ? (
                      <ul className="space-y-4">{toDevelop.map((skill) => <SkillLine key={skill.code} skill={skill} framework={framework} />)}</ul>
                    ) : (
                      <p className="text-[0.9375rem] text-ink-muted">Les compétences observées sont à un niveau homogène.</p>
                    )}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader as="h3" title={<span className="inline-flex items-center gap-2"><ArrowUpRight className="size-[1.125rem] text-success" aria-hidden />Évolutions</span>} />
                  <CardBody>
                    {progressions.length > 0 ? (
                      <ul className="space-y-4">{progressions.map((skill) => <SkillLine key={skill.code} skill={skill} framework={framework} showDelta />)}</ul>
                    ) : (
                      <p className="text-[0.9375rem] text-ink-muted">
                        Une évolution apparaît lorsqu’une même compétence a été observée lors de plusieurs sessions.
                      </p>
                    )}
                  </CardBody>
                </Card>
              </div>
            )}
          </section>
        );
      })}

      <section aria-labelledby="bilan-retours">
        <h2 id="bilan-retours" className="mb-3 text-title">Retours et conseils des formateurs</h2>
        {feedback.length > 0 ? (
          <ol className="space-y-3">
            {feedback.map((evaluation) => (
              <li key={evaluation.id} className="rounded-lg border border-line bg-white p-5">
                <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-subtle">
                  <span className="font-semibold text-ink">Session {evaluation.sessionNumber} · {evaluation.sessionTitle}</span>
                  <span>{formatDate(evaluation.date)}</span>
                  {evaluation.evaluator ? <span>{evaluation.evaluator}</span> : null}
                </p>
                {evaluation.observation ? (
                  <p className="mt-2 flex gap-2.5 text-ink">
                    <MessageSquareText className="mt-1 size-4 shrink-0 text-petrol-500" aria-hidden />
                    {evaluation.observation}
                  </p>
                ) : null}
                {evaluation.advice ? (
                  <p className="mt-3 rounded-md bg-orange-50 px-3 py-2 text-ink">
                    <span className="font-semibold">Conseil : </span>
                    {evaluation.advice}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <Card>
            <CardBody className="text-[0.9375rem] text-ink-muted">Aucun commentaire pour le moment.</CardBody>
          </Card>
        )}
      </section>
    </div>
  );
}
