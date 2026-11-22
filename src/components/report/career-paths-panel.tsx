import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import type { CareerPath, CareerPaths } from '@/lib/career-paths/model';
import {
  ANCHORS_LABEL,
  anchorLine,
  basisLabel,
  careerPathsLead,
  CAREER_PATHS_TITLE,
  careerPathsView,
  EXAMPLES_LABEL,
  ficheLabel,
  sourceLine,
} from '@/lib/report/career-paths-copy';
import { cn } from '@/lib/utils';

/**
 * « Pistes à explorer » dans l'espace de relecture : mêmes textes que le PDF.
 * Les pistes ne sont pas classées : pas de numéro, ordre du moteur conservé.
 */
export function CareerPathsPanel({ careerPaths, hidden, review }: { careerPaths: CareerPaths | null | undefined; hidden: boolean; review: boolean }) {
  const view = careerPathsView(careerPaths, { hidden, review });
  if (view.kind === 'none' || !careerPaths) return null;
  return (
    <Card>
      <CardHeader title={CAREER_PATHS_TITLE} description={view.kind === 'paths' ? careerPathsLead(view.paths.length) : undefined} />
      <CardBody className="space-y-4">
        {view.kind === 'unavailable' ? (
          <p className="rounded-md bg-paper px-4 py-3 text-sm text-ink">{view.message}</p>
        ) : (
          <>
            <ul className="grid gap-4 lg:grid-cols-3">
              {view.paths.map((path) => (
                <PathCard key={`${path.subdomain.code}-${path.ficheCode}`} path={path} />
              ))}
            </ul>
            <p className="text-sm text-ink-muted">{sourceLine(careerPaths.source)}</p>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function PathCard({ path }: { path: CareerPath }) {
  const opening = path.basis === 'opening';
  return (
    <li className="flex min-w-0 flex-col gap-3 border-t-2 border-petrol-900 pt-3">
      <div>
        <p className="text-sm text-ink-muted">{path.domain.label}</p>
        <h3 className="mt-0.5 font-display text-base leading-snug font-semibold text-petrol-900">{path.subdomain.label}</h3>
        <p className={cn('mt-2 inline-block rounded-md px-2 py-0.5 text-sm', opening ? 'bg-orange-50 text-orange-700' : 'bg-petrol-50 text-petrol-900')}>{basisLabel(path)}</p>
      </div>
      {path.examples.length ? (
        <div className="text-sm">
          <p className="font-semibold">{EXAMPLES_LABEL}</p>
          <p>{path.examples.join(' ; ')}</p>
        </div>
      ) : null}
      <div className="text-sm">
        <p className="font-semibold">{ANCHORS_LABEL}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-orange-500">
          {path.anchors.map((anchor) => (
            <li key={anchor.code}>{anchorLine(anchor)}</li>
          ))}
        </ul>
      </div>
      <p className="mt-auto text-xs text-ink-subtle">{ficheLabel(path.ficheCode)}</p>
    </li>
  );
}
