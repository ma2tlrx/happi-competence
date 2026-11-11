'use client';

import { CheckCircle2, Eye, EyeOff, FileDown, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';

import { createReport, deleteDraft, finalizeReport, regenerateContent, saveReport } from '@/app/formateur/participants/[id]/bilan/actions';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form';
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice } from '@/components/ui/primitives';
import type { ActionState } from '@/lib/action-state';
import {
  BEHAVIOUR_THEMES,
  emptyContent,
  PRIORITIES,
  REPORT_SECTIONS,
  type BehaviourTheme,
  type ReportContent,
  type ReportOptions,
  type ReportSection,
} from '@/lib/report/content';
import type { StoredReport } from '@/lib/report/load';
import type { ReportData } from '@/lib/report/model';
import { cn, formatDateTime } from '@/lib/utils';

export type ReportSummary = Pick<StoredReport, 'id' | 'version' | 'status' | 'contentSource' | 'createdAt' | 'finalizedAt'>;

const SOURCE_LABEL = { ai: 'Rédigé par l’IA, non retouché', ai_edited: 'Rédigé par l’IA, relu et modifié', manual: 'Rédigé par l’équipe' } as const;

/**
 * Espace « Bilan » d'un participant : versions, génération, relecture, aperçu fidèle
 * (le PDF lui-même), téléchargement et validation.
 */
export function ReportWorkspace({
  participant,
  reports,
  selected,
  aiReady,
}: {
  participant: { id: string; name: string };
  reports: ReportSummary[];
  selected: StoredReport | null;
  aiReady: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [task, setTask] = useState<'create' | 'ai' | 'save' | 'finalize' | 'delete' | null>(null);
  const [message, setMessage] = useState<ActionState<{ reportId: string } | undefined>>(null);
  const [preview, setPreview] = useState(true);

  const run = (kind: NonNullable<typeof task>, action: () => Promise<ActionState<{ reportId: string } | undefined>>) => {
    setTask(kind);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result);
      setTask(null);
      const reportId = result?.data && 'reportId' in result.data ? result.data.reportId : null;
      if (reportId) router.push(`/formateur/participants/${participant.id}/bilan?version=${reportId}`);
      else router.refresh();
    });
  };

  const busy = pending && (task === 'create' || task === 'ai');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => run('create', () => createReport(participant.id, aiReady))} loading={pending && task === 'create'} disabled={pending}>
          <Plus aria-hidden />
          {reports.length ? 'Générer un nouveau bilan' : 'Générer le bilan'}
        </Button>
        <p className="text-sm text-ink-muted">
          {aiReady
            ? 'Le bilan fige les résultats validés à cette date, puis l’IA en rédige le texte. Vous relisez avant de valider.'
            : 'La rédaction automatique n’est pas configurée : le bilan sera créé avec ses résultats, à rédiger par vos soins.'}
        </p>
      </div>

      {busy ? (
        <Notice variant="info">
          <span className="font-semibold">{task === 'create' ? 'Génération du bilan en cours.' : 'Rédaction en cours.'}</span> Les résultats sont figés, puis
          le texte est rédigé et contrôlé : comptez 30 secondes à 2 minutes. Gardez cette page ouverte.
        </Notice>
      ) : null}
      {message?.message ? <Notice variant={message.ok ? 'success' : 'danger'}>{message.message}</Notice> : null}

      {reports.length === 0 ? (
        <EmptyState
          title="Aucun bilan pour l’instant"
          description={`Générez le premier bilan de ${participant.name}. Il s’appuie uniquement sur les évaluations validées par les formateurs.`}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <nav aria-label="Versions du bilan">
            <h2 className="mb-2 text-sm font-semibold text-ink-muted">Versions</h2>
            <ul className="space-y-1.5">
              {reports.map((report) => (
                <li key={report.id}>
                  <Link
                    href={`/formateur/participants/${participant.id}/bilan?version=${report.id}`}
                    aria-current={selected?.id === report.id ? 'page' : undefined}
                    className={cn(
                      'block rounded-md border px-3 py-2.5 text-sm transition-colors',
                      selected?.id === report.id ? 'border-petrol-900 bg-petrol-50' : 'border-line bg-white hover:border-petrol-300',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">Version {report.version}</span>
                      {report.status === 'final' ? <Badge variant="success">Validé</Badge> : <Badge variant="orange">Brouillon</Badge>}
                    </span>
                    <span className="mt-0.5 block text-ink-subtle">{formatDateTime(report.finalizedAt ?? report.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {selected ? (
            <div className="min-w-0 space-y-6">
              <Card>
                <CardHeader
                  title={`Version ${selected.version}${selected.status === 'final' ? ' · validée' : ' · brouillon'}`}
                  description={
                    <>
                      Résultats figés le {formatDateTime(selected.data.generatedAt)}
                      {selected.contentSource ? ` · ${SOURCE_LABEL[selected.contentSource]}` : ' · texte non rédigé'}
                      {selected.finalizedAt ? ` · validé le ${formatDateTime(selected.finalizedAt)}` : ''}
                    </>
                  }
                  action={
                    <>
                      <Button variant="outline" size="sm" onClick={() => setPreview((value) => !value)} aria-pressed={preview}>
                        {preview ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                        {preview ? 'Masquer l’aperçu' : 'Prévisualiser'}
                      </Button>
                      <Button asChild size="sm">
                        <a href={`/api/exports/bilan/${selected.id}`} download>
                          <FileDown aria-hidden />
                          Télécharger le PDF
                        </a>
                      </Button>
                    </>
                  }
                />
                <CardBody className="space-y-4">
                  <DataSummary data={selected.data} />
                  {selected.status === 'draft' ? (
                    <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => run('ai', () => regenerateContent(selected.id))}
                        loading={pending && task === 'ai'}
                        disabled={pending || !aiReady || selected.data.counts.observations === 0}
                      >
                        {selected.content ? <RefreshCw aria-hidden /> : <Sparkles aria-hidden />}
                        {selected.content ? 'Régénérer le texte' : 'Rédiger avec l’IA'}
                      </Button>
                      <ConfirmButton
                        label="Valider le bilan"
                        confirm="Confirmer la validation"
                        hint="Un bilan validé n’est plus modifiable et devient visible du participant et de son organisme."
                        icon={<CheckCircle2 aria-hidden />}
                        disabled={pending || !selected.content}
                        onConfirm={() => run('finalize', () => finalizeReport(selected.id))}
                      />
                      <ConfirmButton
                        label="Supprimer ce brouillon"
                        confirm="Confirmer la suppression"
                        variant="danger-outline"
                        icon={<Trash2 aria-hidden />}
                        disabled={pending}
                        onConfirm={() => run('delete', async () => {
                          const result = await deleteDraft(selected.id);
                          if (result?.ok) router.push(`/formateur/participants/${participant.id}/bilan`);
                          return result;
                        })}
                      />
                    </div>
                  ) : (
                    <Notice variant="success">Ce bilan est validé : il est figé et le participant comme son organisme peuvent le télécharger.</Notice>
                  )}
                </CardBody>
              </Card>

              {preview ? (
                <Card className="overflow-hidden">
                  <iframe
                    key={`${selected.id}-${selected.updatedAt}`}
                    src={`/api/exports/bilan/${selected.id}?apercu=1#view=FitH`}
                    title={`Aperçu du bilan, version ${selected.version}`}
                    className="h-[80svh] min-h-[32rem] w-full bg-paper"
                  />
                </Card>
              ) : null}

              {selected.status === 'draft' ? (
                <ContentEditor
                  key={`${selected.id}-${selected.updatedAt}`}
                  report={selected}
                  pending={pending && task === 'save'}
                  onSave={(content, options) => {
                    setTask('save');
                    setMessage(null);
                    startTransition(async () => {
                      const result = await saveReport({ reportId: selected.id, content, options });
                      setMessage(result);
                      setTask(null);
                      if (result?.ok) router.refresh();
                    });
                  }}
                  errors={message && !message.ok ? (message.fieldErrors ?? {}) : {}}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ConfirmButton({
  label,
  confirm,
  hint,
  icon,
  variant = 'outline',
  disabled,
  onConfirm,
}: {
  label: string;
  confirm: string;
  hint?: string;
  icon: ReactNode;
  variant?: 'outline' | 'danger-outline';
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <Button variant={variant} size="sm" disabled={disabled} onClick={() => setArmed(true)}>
        {icon}
        {label}
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 rounded-md bg-paper px-2 py-1">
      {hint ? <span className="text-sm text-ink-muted">{hint}</span> : null}
      <Button
        variant={variant === 'danger-outline' ? 'danger' : 'primary'}
        size="sm"
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        {confirm}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setArmed(false)}>
        Annuler
      </Button>
    </span>
  );
}

function DataSummary({ data }: { data: ReportData }) {
  const stats = [
    ['Sessions suivies', `${data.counts.sessionsAttended}/${data.counts.sessionsPlanned}`],
    ['Sessions évaluées', String(data.counts.sessionsEvaluated)],
    ['Observations', String(data.counts.observations)],
    ['Compétences observées', `${data.counts.skillsObserved}/${data.counts.skillsTotal}`],
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-md bg-paper px-3 py-2">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="font-display text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {data.missing.length ? (
        <details className="rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-sm">
          <summary className="font-semibold text-warning">
            {data.missing.length} donnée{data.missing.length > 1 ? 's' : ''} manquante{data.missing.length > 1 ? 's' : ''} ou insuffisante
            {data.missing.length > 1 ? 's' : ''} (signalées dans le bilan)
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
            {data.missing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

// ── Relecture et rédaction ────────────────────────────────────────────────────
function lines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function ContentEditor({
  report,
  pending,
  onSave,
  errors,
}: {
  report: StoredReport;
  pending: boolean;
  onSave: (content: ReportContent, options: ReportOptions) => void;
  errors: Record<string, string>;
}) {
  const { data } = report;
  const [content, setContent] = useState<ReportContent>(() => report.content ?? emptyContent(data));
  const [options, setOptions] = useState<ReportOptions>(report.options);
  const [traits, setTraits] = useState(() => content.profile.traits.join('\n'));
  const [warnings, setWarnings] = useState(() => content.dataWarnings.join('\n'));
  const skills = data.frameworks.flatMap((framework) => framework.skills.map((skill) => ({ ...skill, framework })));
  const observed = skills.filter((skill) => skill.status !== 'not_observed');
  const evaluatedSessions = data.sessions.filter((session) => session.evaluated).map((session) => session.number);
  const update = (patch: Partial<ReportContent>) => setContent((current) => ({ ...current, ...patch }));
  const error = (path: string) => errors[path] ?? null;
  const errorCount = Object.keys(errors).length;

  const submit = () => onSave({ ...content, profile: { ...content.profile, traits: lines(traits) }, dataWarnings: lines(warnings) }, options);

  return (
    <Card>
      <CardHeader
        title="Relire et compléter le texte"
        description="Les niveaux et observations viennent des évaluations validées et ne se modifient pas ici. N’écrivez pas de note chiffrée dans le texte : elles sont affichées automatiquement."
      />
      <CardBody className="space-y-8">
        {errorCount ? <Notice variant="danger">{errorCount} passage(s) à corriger : ils sont signalés sous les champs concernés.</Notice> : null}

        <fieldset className="space-y-4">
          <legend className="mb-2 font-display text-base font-semibold">Mise en forme</legend>
          <Field label="Structure accompagnatrice affichée" optional hint={data.organization ? `Par défaut : ${data.organization}` : 'Aucune structure rattachée.'}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                maxLength={120}
                value={options.structureName ?? ''}
                onChange={(event) => setOptions({ ...options, structureName: event.target.value || null })}
              />
            )}
          </Field>
          <Field label="Observations complémentaires du formateur" optional hint="Affichées comme observation humaine, distincte des évaluations de session.">
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                maxLength={3000}
                rows={3}
                value={options.extraObservations ?? ''}
                onChange={(event) => setOptions({ ...options, extraObservations: event.target.value || null })}
              />
            )}
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Sections à masquer</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(REPORT_SECTIONS) as ReportSection[]).map((section) => (
                <Checkbox
                  key={section}
                  label={REPORT_SECTIONS[section]}
                  checked={options.hiddenSections.includes(section)}
                  onChange={(event) =>
                    setOptions({
                      ...options,
                      hiddenSections: event.target.checked ? [...options.hiddenSections, section] : options.hiddenSections.filter((item) => item !== section),
                    })
                  }
                />
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 font-display text-base font-semibold">Introduction et profil</legend>
          <TextBlock label="Introduction" rows={7} value={content.introduction} error={error('introduction')} onChange={(introduction) => update({ introduction })} />
          <TextBlock
            label="Synthèse du profil"
            rows={4}
            value={content.profile.summary}
            error={error('profile.summary')}
            onChange={(summary) => update({ profile: { ...content.profile, summary } })}
          />
          <TextBlock label="Caractéristiques observées (une par ligne)" rows={4} value={traits} onChange={setTraits} />
          {content.frameworks.map((item, index) => (
            <TextBlock
              key={item.code}
              label={`Lecture : ${data.frameworks.find((framework) => framework.code === item.code)?.name ?? item.code}`}
              rows={3}
              value={item.summary}
              error={error(`frameworks.${index}.summary`)}
              onChange={(summary) => update({ frameworks: content.frameworks.map((entry, i) => (i === index ? { ...entry, summary } : entry)) })}
            />
          ))}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 font-display text-base font-semibold">Façon d’agir en situation de jeu</legend>
          <TextBlock label="Lecture d’ensemble" rows={4} value={content.behaviour.summary} error={error('behaviour.summary')} onChange={(summary) => update({ behaviour: { ...content.behaviour, summary } })} />
          {content.behaviour.themes.map((item, index) => (
            <div key={index} className="space-y-3 rounded-md border border-line p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                <Field label="Aspect observé">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={item.theme}
                      onChange={(event) =>
                        update({ behaviour: { ...content.behaviour, themes: content.behaviour.themes.map((entry, i) => (i === index ? { ...entry, theme: event.target.value as BehaviourTheme } : entry)) } })
                      }
                    >
                      {(Object.keys(BEHAVIOUR_THEMES) as BehaviourTheme[]).map((theme) => (
                        <option key={theme} value={theme}>
                          {BEHAVIOUR_THEMES[theme]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Sessions évaluées" error={error(`behaviour.themes.${index}.sessions`)} hint={`Parmi : ${evaluatedSessions.join(', ') || 'aucune'}`}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      inputMode="numeric"
                      value={item.sessions.join(', ')}
                      onChange={(event) => {
                        const sessions = event.target.value
                          .split(/[^0-9]+/)
                          .filter(Boolean)
                          .map(Number);
                        update({ behaviour: { ...content.behaviour, themes: content.behaviour.themes.map((entry, i) => (i === index ? { ...entry, sessions } : entry)) } });
                      }}
                    />
                  )}
                </Field>
                <Button variant="ghost" size="sm" onClick={() => update({ behaviour: { ...content.behaviour, themes: content.behaviour.themes.filter((_, i) => i !== index) } })}>
                  <Trash2 aria-hidden />
                  Retirer
                </Button>
              </div>
              <TextBlock
                label="Ce qui a été observé"
                rows={2}
                value={item.text}
                error={error(`behaviour.themes.${index}.text`)}
                onChange={(text) => update({ behaviour: { ...content.behaviour, themes: content.behaviour.themes.map((entry, i) => (i === index ? { ...entry, text } : entry)) } })}
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={evaluatedSessions.length === 0}
            onClick={() => update({ behaviour: { ...content.behaviour, themes: [...content.behaviour.themes, { theme: 'cooperation', text: '', sessions: evaluatedSessions.slice(0, 1) }] } })}
          >
            <Plus aria-hidden />
            Ajouter un aspect observé
          </Button>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 font-display text-base font-semibold">Fiches des compétences observées ({observed.length})</legend>
          {observed.map((skill) => {
            const index = content.skills.findIndex((item) => item.code === skill.code);
            const item = index >= 0 ? content.skills[index]! : { code: skill.code, observed: '', strengths: '', progress: '', professional: '' };
            const set = (key: 'observed' | 'strengths' | 'progress' | 'professional', value: string) => {
              const next = { ...item, [key]: value };
              update({ skills: index >= 0 ? content.skills.map((entry, i) => (i === index ? next : entry)) : [...content.skills, next] });
            };
            const filled = [item.observed, item.strengths, item.progress, item.professional].filter((value) => value.trim()).length;
            return (
              <details key={skill.code} className="rounded-md border border-line px-4 py-3" open={Boolean(index >= 0 && errors[`skills.${index}.observed`])}>
                <summary className="cursor-pointer">
                  <span className="font-semibold">{skill.name}</span>
                  <span className="ml-2 text-sm text-ink-muted">
                    {skill.framework.shortName} · {skill.levelLabel} · {skill.status === 'single' ? '1 observation, à confirmer' : `${skill.observations.length} observations`} · {filled}/4 rubriques
                  </span>
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ['observed', 'Ce qui a été observé'],
                      ['strengths', 'Points d’appui'],
                      ['progress', 'Axes de progression'],
                      ['professional', 'Dans un contexte professionnel'],
                    ] as const
                  ).map(([key, label]) => (
                    <TextBlock key={key} label={label} rows={3} value={item[key]} error={index >= 0 ? error(`skills.${index}.${key}`) : null} onChange={(value) => set(key, value)} />
                  ))}
                </div>
              </details>
            );
          })}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 font-display text-base font-semibold">Recommandations</legend>
          {content.recommendations.map((item, index) => {
            const set = (patch: Partial<typeof item>) => update({ recommendations: content.recommendations.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)) });
            return (
              <div key={index} className="space-y-3 rounded-md border border-line p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
                  <Field label="Compétence" error={error(`recommendations.${index}.skillCode`)}>
                    {({ id }) => (
                      <Select id={id} value={item.skillCode} onChange={(event) => set({ skillCode: event.target.value })}>
                        {skills.map((skill) => (
                          <option key={skill.code} value={skill.code}>
                            {skill.name}
                            {skill.status === 'not_observed' ? ' (non observée)' : ''}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Priorité">
                    {({ id }) => (
                      <Select id={id} value={item.priority} onChange={(event) => set({ priority: event.target.value as keyof typeof PRIORITIES })}>
                        {(Object.keys(PRIORITIES) as (keyof typeof PRIORITIES)[]).map((priority) => (
                          <option key={priority} value={priority}>
                            {PRIORITIES[priority]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Button variant="ghost" size="sm" onClick={() => update({ recommendations: content.recommendations.filter((_, i) => i !== index) })}>
                    <Trash2 aria-hidden />
                    Retirer
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ['why', 'Pourquoi'],
                      ['action', 'Action proposée'],
                      ['exercise', 'Mise en situation ou exercice'],
                      ['worksOn', 'Ce que cela travaille'],
                      ['goal', 'Objectif de progression'],
                    ] as const
                  ).map(([key, label]) => (
                    <TextBlock key={key} label={label} rows={2} value={item[key]} error={error(`recommendations.${index}.${key}`)} onChange={(value) => set({ [key]: value })} />
                  ))}
                </div>
              </div>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            disabled={observed.length === 0}
            onClick={() =>
              update({
                recommendations: [...content.recommendations, { skillCode: observed[0]!.code, priority: 'consolider', why: '', action: '', exercise: '', worksOn: '', goal: '' }],
              })
            }
          >
            <Plus aria-hidden />
            Ajouter une recommandation
          </Button>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 font-display text-base font-semibold">Synthèse et limites</legend>
          <TextBlock label="Synthèse finale" rows={6} value={content.conclusion} error={error('conclusion')} onChange={(conclusion) => update({ conclusion })} />
          <TextBlock label="Phrase de valorisation finale" rows={2} value={content.closing} error={error('closing')} onChange={(closing) => update({ closing })} />
          <TextBlock label="Limites propres à ce bilan" rows={3} value={content.limits} error={error('limits')} onChange={(limits) => update({ limits })} />
          <TextBlock label="Points sur lesquels les données ne permettent pas de conclure (un par ligne)" rows={3} value={warnings} onChange={setWarnings} />
        </fieldset>

        <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-line bg-white/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <Button onClick={submit} loading={pending}>
            Enregistrer le texte
          </Button>
          <span className="text-sm text-ink-muted">L’aperçu se met à jour après l’enregistrement.</span>
        </div>
      </CardBody>
    </Card>
  );
}

function TextBlock({ label, value, onChange, rows, error }: { label: string; value: string; onChange: (value: string) => void; rows: number; error?: string | null }) {
  return (
    <Field label={label} error={error}>
      {({ id, describedBy, invalid }) => (
        <Textarea id={id} aria-describedby={describedBy} aria-invalid={invalid} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </Field>
  );
}
