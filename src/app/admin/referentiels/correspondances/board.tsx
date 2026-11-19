'use client';

import { Check, Plus, Search, Trash2, Undo2, X } from 'lucide-react';
import { useActionState, useEffect, useId, useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { Badge } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import {
  LINK_TYPE_ORDER,
  LINK_TYPES,
  MAPPING_STATUS,
  searchExternalSkills,
  sourceMention,
  type AdminMapping,
  type AdminSkillRow,
  type ExternalSkillOption,
} from '@/lib/public-frameworks/mappings';
import { formatDate } from '@/lib/utils';

import { proposeMapping, removeMapping, setMappingLinkType, unvalidateMapping, validateMapping } from './actions';

type Simple = { ok: boolean; message?: string };
type SourceOption = { code: string; name: string; version: string };

function useRun() {
  const [pending, start] = useTransition();
  return {
    pending,
    run: (action: () => Promise<Simple>, success: string, confirm?: string) =>
      start(async () => {
        if (confirm && !window.confirm(confirm)) return;
        const result = await action();
        if (result.ok) toast.success(success);
        else toast.error(result.message ?? 'Action impossible.');
      }),
  };
}

/** Tableau des correspondances : une carte par compétence HAPPI. */
export function MappingsBoard({ rows, options, sources }: { rows: AdminSkillRow[]; options: ExternalSkillOption[]; sources: SourceOption[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="space-y-4">
      {rows.map((row) => {
        const key = `${row.frameworkCode}:${row.code}`;
        return (
          <li key={key}>
            <SkillMappings row={row} options={options} sources={sources} open={open === key} onToggle={(value) => setOpen(value ? key : null)} />
          </li>
        );
      })}
    </ul>
  );
}

function SkillMappings({
  row,
  options,
  sources,
  open,
  onToggle,
}: {
  row: AdminSkillRow;
  options: ExternalSkillOption[];
  sources: SourceOption[];
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const headingId = useId();
  return (
    <article className="rounded-lg border border-line bg-white p-4 sm:p-5" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-subtle">{row.frameworkName}</p>
          <h2 id={headingId} className="font-display text-base leading-snug font-semibold break-words">
            {row.name}
          </h2>
          {row.description ? <p className="mt-1 text-sm text-ink-muted">{row.description}</p> : null}
        </div>
        <Button size="sm" variant={open ? 'ghost' : 'outline'} onClick={() => onToggle(!open)} aria-expanded={open} disabled={options.length === 0}>
          {open ? <X aria-hidden /> : <Plus aria-hidden />}
          {open ? 'Fermer' : 'Proposer une correspondance'}
        </Button>
      </div>

      {row.mappings.length > 0 ? (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {row.mappings.map((mapping) => (
            <MappingItem key={mapping.id} mapping={mapping} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-subtle">Aucune correspondance pour l’instant.</p>
      )}

      {open ? <ProposeForm row={row} options={options} sources={sources} onDone={() => onToggle(false)} /> : null}
    </article>
  );
}

function MappingItem({ mapping }: { mapping: AdminMapping }) {
  const { pending, run } = useRun();
  const status = MAPPING_STATUS[mapping.status];
  const external = mapping.external;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold break-words text-ink">{external.label}</span>
        <Badge variant={status.variant}>{status.label}</Badge>
        <Badge variant="outline">{LINK_TYPES[mapping.linkType].label}</Badge>
        {mapping.origin === 'label_match' ? <Badge variant="neutral">Proposition automatique</Badge> : null}
        {!external.isActive ? <Badge variant="danger">Absent du dernier import</Badge> : null}
      </div>
      <p className="mt-0.5 text-sm break-words text-ink-muted">
        {sourceMention(external.source)} · <span className="break-all">{external.code}</span>
      </p>
      {external.definition ? <p className="mt-1 text-sm text-ink-muted">Définition de la source : {external.definition}</p> : null}
      {mapping.justification ? <p className="mt-1 text-sm text-ink-muted">Justification : {mapping.justification}</p> : null}
      <p className="mt-1 text-xs text-ink-subtle">
        Proposée le {formatDate(mapping.proposedAt)}
        {mapping.proposedBy ? ` par ${mapping.proposedBy}` : mapping.origin === 'label_match' ? ' par le script d’import' : ''}
        {mapping.status === 'validated' ? ` · validée le ${formatDate(mapping.validatedAt)}${mapping.validatedBy ? ` par ${mapping.validatedBy}` : ''}` : ''}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {mapping.status === 'proposed' ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">Type de lien pour {external.label}</span>
              <Select
                className="min-h-8 py-1 text-sm"
                defaultValue={mapping.linkType}
                disabled={pending}
                onChange={(event) => run(() => setMappingLinkType(mapping.id, event.target.value), 'Type de lien modifié.')}
              >
                {LINK_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {LINK_TYPES[type].label}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              size="sm"
              loading={pending}
              onClick={() =>
                run(
                  () => validateMapping(mapping.id),
                  'Correspondance validée.',
                  `Valider la correspondance « ${external.label} » (${LINK_TYPES[mapping.linkType].label.toLowerCase()}) ? Elle sera affichée aux participants, aux conseillers et sur les pages de vérification.`,
                )
              }
            >
              <Check aria-hidden />
              Valider
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => unvalidateMapping(mapping.id), 'Correspondance repassée en proposée.', 'Retirer la validation ? La correspondance ne sera plus affichée hors administration.')}>
            <Undo2 aria-hidden />
            Repasser en proposée
          </Button>
        )}
        <Button size="sm" variant="danger-outline" loading={pending} onClick={() => run(() => removeMapping(mapping.id), 'Correspondance retirée.', `Retirer définitivement la correspondance avec « ${external.label} » ?`)}>
          <Trash2 aria-hidden />
          Retirer
        </Button>
      </div>
    </li>
  );
}

function ProposeForm({ row, options, sources, onDone }: { row: AdminSkillRow; options: ExternalSkillOption[]; sources: SourceOption[]; onDone: () => void }) {
  const [state, action] = useActionState(proposeMapping, null);
  const [query, setQuery] = useState(row.name);
  const [source, setSource] = useState('');
  const [selected, setSelected] = useState<string>('');
  const listId = useId();
  const taken = useMemo(() => row.mappings.map((mapping) => mapping.external.id), [row.mappings]);
  const results = useMemo(() => searchExternalSkills(options, query, { sourceCode: source || null, excludeIds: taken, limit: 15 }), [options, query, source, taken]);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'Correspondance proposée.');
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="mt-4 space-y-4 rounded-md border border-line bg-paper p-3 sm:p-4">
      <input type="hidden" name="frameworkId" value={row.frameworkId} />
      <input type="hidden" name="skillCode" value={row.code} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field label="Rechercher un élément externe" hint="Libellé, code ou mot de la définition ; accents et majuscules ignorés.">
          {({ id, describedBy }) => (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input id={id} type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-describedby={describedBy} aria-controls={listId} className="pl-9" autoComplete="off" />
            </div>
          )}
        </Field>
        <Field label="Référentiel public">
          {({ id }) => (
            <Select id={id} value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">Tous</option>
              {sources.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name} {item.version}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Élément externe ({results.length} résultat{results.length > 1 ? 's' : ''})</legend>
        <div id={listId} className="max-h-80 space-y-1.5 overflow-y-auto" aria-live="polite">
          {results.length === 0 ? <p className="text-sm text-ink-muted">Aucun élément ne correspond : essayez un autre mot.</p> : null}
          {results.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-white px-3 py-2 has-[:checked]:border-petrol-500 has-[:checked]:bg-petrol-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-petrol-500"
            >
              <input type="radio" name="externalSkillId" value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} className="mt-1 size-4 shrink-0 accent-petrol-700" />
              <span className="min-w-0 text-sm">
                <span className="block font-semibold break-words text-ink">{option.label}</span>
                <span className="block text-xs break-words text-ink-subtle">
                  {option.source.name} {option.source.version} · <span className="break-all">{option.code}</span>
                </span>
                {option.definition ? <span className="mt-0.5 line-clamp-3 block text-ink-muted">{option.definition}</span> : null}
              </span>
            </label>
          ))}
        </div>
        {state?.fieldErrors?.externalSkillId ? <p className="mt-1 text-sm text-danger">{state.fieldErrors.externalSkillId}</p> : null}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Field label="Type de lien" error={state?.fieldErrors?.linkType}>
          {({ id, describedBy }) => (
            <Select id={id} name="linkType" defaultValue="close" aria-describedby={describedBy}>
              {LINK_TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {LINK_TYPES[type].label} — {LINK_TYPES[type].description}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Justification" optional error={state?.fieldErrors?.justification}>
          {({ id, describedBy }) => <Textarea id={id} name="justification" rows={2} maxLength={1000} aria-describedby={describedBy} placeholder="Pourquoi ce rapprochement ? (comparaison des définitions…)" />}
        </Field>
      </div>

      {state && !state.ok ? <FormMessage state={state} /> : null}
      <div className="flex flex-wrap gap-2">
        <SubmitButton disabled={!selected}>
          <Plus aria-hidden />
          Proposer
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
      </div>
      <p className="text-xs text-ink-subtle">La proposition reste invisible hors administration tant qu’elle n’est pas validée.</p>
    </form>
  );
}
