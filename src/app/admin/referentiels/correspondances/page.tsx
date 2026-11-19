import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, StatTile } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import {
  filterSkillRows,
  isLinkType,
  mappingCounts,
  parseMappingFilters,
  type AdminSkillRow,
  type ExternalSkillOption,
  type MappingStatus,
} from '@/lib/public-frameworks/mappings';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

import { MappingsBoard } from './board';

export const metadata: Metadata = { title: 'Correspondances avec les référentiels publics' };

export default async function MappingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole('admin');
  const filters = parseMappingFilters(await searchParams);
  const supabase = await createClient();
  const [{ data: frameworks }, { data: sources }, { data: externals }, { data: mappings }, { data: staff }] = await Promise.all([
    supabase.from('frameworks').select('id, code, name, position, framework_versions ( id, version_number, status )').order('position'),
    supabase.from('external_frameworks').select('id, code, name, publisher, version, source_url, license, retrieved_on, notes').order('position').order('name'),
    supabase.from('external_skills').select('id, framework_id, code, label, definition, is_active, position').order('position').limit(5000),
    supabase
      .from('skill_mappings')
      .select('id, framework_id, skill_code, external_skill_id, link_type, status, origin, justification, proposed_by, proposed_at, validated_by, validated_at')
      .limit(5000),
    supabase.from('staff_directory').select('id, first_name, last_name'),
  ]);

  // Compétences HAPPI : celles de la dernière version publiée de chaque référentiel (à défaut, la plus récente).
  const versionOf = new Map<string, string>();
  for (const framework of frameworks ?? []) {
    const versions = [...framework.framework_versions].sort((a, b) => b.version_number - a.version_number);
    const chosen = versions.find((version) => version.status === 'published') ?? versions[0];
    if (chosen) versionOf.set(chosen.id, framework.id);
  }
  const { data: skills } = versionOf.size
    ? await supabase.from('skills').select('version_id, code, name, description, position, is_active').in('version_id', [...versionOf.keys()]).order('position')
    : { data: [] };

  const sourceById = new Map((sources ?? []).map((source) => [source.id, source]));
  const options: ExternalSkillOption[] = (externals ?? []).flatMap((item) => {
    const source = sourceById.get(item.framework_id);
    if (!source) return [];
    return [{ id: item.id, code: item.code, label: item.label, definition: item.definition, isActive: item.is_active, source: { code: source.code, name: source.name, publisher: source.publisher, version: source.version } }];
  });
  const optionById = new Map(options.map((option) => [option.id, option]));
  const staffName = new Map((staff ?? []).map((person) => [person.id, `${person.first_name} ${person.last_name}`.trim()]));
  const frameworkById = new Map((frameworks ?? []).map((framework) => [framework.id, framework]));

  const rows: AdminSkillRow[] = (skills ?? [])
    .filter((skill) => skill.is_active)
    .flatMap((skill) => {
      const framework = frameworkById.get(versionOf.get(skill.version_id) ?? '');
      if (!framework) return [];
      return [
        {
          frameworkId: framework.id,
          frameworkCode: framework.code,
          frameworkName: framework.name,
          code: skill.code,
          name: skill.name,
          description: skill.description,
          mappings: (mappings ?? [])
            .filter((mapping) => mapping.framework_id === framework.id && mapping.skill_code === skill.code)
            .flatMap((mapping) => {
              const external = optionById.get(mapping.external_skill_id);
              if (!external || !isLinkType(mapping.link_type)) return [];
              return [
                {
                  id: mapping.id,
                  status: mapping.status as MappingStatus,
                  linkType: mapping.link_type,
                  origin: mapping.origin === 'label_match' ? ('label_match' as const) : ('manual' as const),
                  justification: mapping.justification,
                  proposedAt: mapping.proposed_at,
                  proposedBy: mapping.proposed_by ? (staffName.get(mapping.proposed_by) ?? null) : null,
                  validatedAt: mapping.validated_at,
                  validatedBy: mapping.validated_by ? (staffName.get(mapping.validated_by) ?? null) : null,
                  external,
                },
              ];
            }),
        },
      ];
    })
    .sort((a, b) => (frameworkById.get(a.frameworkId)?.position ?? 0) - (frameworkById.get(b.frameworkId)?.position ?? 0));

  const counts = mappingCounts(rows);
  const visible = filterSkillRows(rows, filters);
  const countBySource = new Map<string, number>();
  for (const item of externals ?? []) if (item.is_active) countBySource.set(item.framework_id, (countBySource.get(item.framework_id) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="Correspondances avec les référentiels publics"
        description="Rapprocher chaque compétence HAPPI des savoir-être professionnels de France Travail (ROME) et des compétences transversales ESCO, pour parler le langage des conseillers et des employeurs."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/referentiels">
              <ArrowLeft aria-hidden />
              Référentiels
            </Link>
          </Button>
        }
      />

      <Notice className="mb-6" title="Une décision pédagogique">
        Une correspondance est d’abord proposée, puis validée par un administrateur : elle n’apparaît dans le passeport, le CV de compétences, la page de
        vérification et l’export des résultats qu’une fois validée, toujours avec sa source. Les propositions automatiques ne portent que sur des libellés
        identiques ou quasi identiques ; comparez les définitions avant de valider. Les niveaux observés ne changent pas.
      </Notice>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Compétences HAPPI" value={counts.skills} />
        <StatTile label="Avec une correspondance validée" value={counts.mapped} />
        <StatTile label="Propositions à examiner" value={counts.proposed} />
        <StatTile label="Correspondances validées" value={counts.validated} />
      </div>

      <Card className="mb-6">
        <CardHeader title="Référentiels publics importés" description="Importés depuis leur source officielle (voir docs/referentiels-publics.md) ; aucun élément n’est saisi à la main." />
        <CardBody className="pt-3">
          {(sources ?? []).length === 0 ? (
            <EmptyState
              title="Aucun référentiel public importé"
              description="Téléchargez la liste officielle, puis lancez « npm run referentiels:import » (mode d’emploi dans docs/referentiels-publics.md)."
            />
          ) : (
            <ul className="divide-y divide-line">
              {(sources ?? []).map((source) => (
                <li key={source.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {source.name}
                      <Badge variant="petrol">version {source.version}</Badge>
                    </span>
                    <span className="block text-sm break-words text-ink-muted">
                      {source.publisher} · {countBySource.get(source.id) ?? 0} élément{(countBySource.get(source.id) ?? 0) > 1 ? 's' : ''} · récupéré le {formatDate(source.retrieved_on)} · licence : {source.license}
                    </span>
                  </span>
                  <a href={source.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-petrol-700 underline underline-offset-4">
                    Source officielle
                    <ExternalLink className="size-3.5" aria-hidden />
                    <span className="sr-only">(nouvelle fenêtre)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <form method="get" className="mb-6 grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end" aria-label="Filtrer les compétences">
        <label className="block text-sm font-semibold">
          Compétence
          <Input name="q" type="search" defaultValue={filters.q} placeholder="Nom ou code" className="mt-1" />
        </label>
        <label className="block text-sm font-semibold">
          Référentiel HAPPI
          <Select name="referentiel" defaultValue={filters.framework ?? ''} className="mt-1">
            <option value="">Tous</option>
            {(frameworks ?? []).map((framework) => (
              <option key={framework.id} value={framework.code}>
                {framework.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm font-semibold">
          Statut
          <Select name="statut" defaultValue={filters.status} className="mt-1">
            <option value="all">Toutes les compétences</option>
            <option value="proposed">Avec une proposition à examiner</option>
            <option value="validated">Avec une correspondance validée</option>
            <option value="none">Sans correspondance</option>
          </Select>
        </label>
        <label className="block text-sm font-semibold">
          Référentiel public
          <Select name="source" defaultValue={filters.source ?? ''} className="mt-1">
            <option value="">Tous</option>
            {(sources ?? []).map((source) => (
              <option key={source.id} value={source.code}>
                {source.name} {source.version}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Filtrer</Button>
          <Button asChild variant="ghost">
            <Link href="/admin/referentiels/correspondances">Effacer</Link>
          </Button>
        </div>
      </form>

      <p className="mb-3 text-sm text-ink-muted" role="status">
        {visible.length} compétence{visible.length > 1 ? 's' : ''} affichée{visible.length > 1 ? 's' : ''} sur {rows.length}.
      </p>
      {visible.length === 0 ? (
        <EmptyState title="Aucune compétence ne correspond à ces filtres" description="Modifiez ou effacez les filtres." />
      ) : (
        <MappingsBoard rows={visible} options={options} sources={(sources ?? []).map((source) => ({ code: source.code, name: source.name, version: source.version }))} />
      )}
    </>
  );
}
