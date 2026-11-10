import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Card, CardBody, CardHeader, Notice, PageHeader, Table, TableWrap, Td, Th, Tr } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

import { VERSION_STATUS } from '../labels';
import { CategoryDialog, DeleteCategoryButton, DeleteSkillButton, LevelsForm, MappingCheckbox, SettingsForm, SkillDialog, VersionStatusActions } from '../version-client';

export const metadata: Metadata = { title: 'Version de référentiel' };

export default async function FrameworkVersionPage({ params, searchParams }: { params: Promise<{ versionId: string }>; searchParams: Promise<{ nouvelle?: string }> }) {
  const { versionId } = await params;
  const { nouvelle } = await searchParams;
  if (!isUuid(versionId)) notFound();
  await requireRole('admin');
  const supabase = await createClient();
  const { data: version } = await supabase.from('framework_versions').select('*, frameworks ( name )').eq('id', versionId).maybeSingle();
  if (!version) notFound();
  const [{ data: levels }, { data: categories }, { data: skills }, { data: mapping }, { data: program }] = await Promise.all([
    supabase.from('scale_levels').select('value, label, description').eq('version_id', versionId).order('value'),
    supabase.from('skill_categories').select('id, name, description, position').eq('version_id', versionId).order('position'),
    supabase.from('skills').select('id, code, name, description, category_id, weight, position, is_active, skill_level_descriptors ( level_value, description ), skill_criteria ( label, weight, position )').eq('version_id', versionId).order('position'),
    supabase.from('session_skill_map').select('session_number, skill_id').eq('version_id', versionId),
    supabase.from('programs').select('sessions_count').eq('is_public', true).maybeSingle(),
  ]);
  const draft = version.status === 'draft';
  const sessionNumbers = Array.from({ length: program?.sessions_count ?? 6 }, (_, i) => i + 1);
  const mapped = new Set((mapping ?? []).map((m) => `${m.session_number}:${m.skill_id}`));
  const levelOptions = (levels ?? []).map((l) => ({ value: l.value, label: l.label }));
  const status = VERSION_STATUS[version.status]!;
  const grouped = [...(categories ?? []).map((c) => ({ category: c as typeof c | null, skills: (skills ?? []).filter((s) => s.category_id === c.id) })), { category: null, skills: (skills ?? []).filter((s) => !s.category_id) }].filter((g) => g.category || g.skills.length);

  return (
    <>
      <PageHeader
        back={<Link href="/admin/referentiels" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Référentiels</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{version.frameworks?.name}<Badge variant={status.variant}>{status.label}</Badge></span>}
        description={`${version.label} · version ${version.version_number}`}
        actions={<VersionStatusActions versionId={versionId} status={version.status} />}
      />
      {nouvelle ? <Notice variant="success" className="mb-6" title="Nouvelle version créée">C’est une copie modifiable de la version précédente. Publiez-la quand elle est prête, puis activez-la pour un programme.</Notice> : null}
      {!draft ? <Notice className="mb-6" title="Version figée">Une version publiée ne peut plus être modifiée (hormis son nom et ses notes). Créez une nouvelle version pour faire évoluer le référentiel.</Notice> : null}

      <div className="space-y-6">
        <Card>
          <CardHeader title="Paramètres et règles de calcul" />
          <CardBody><SettingsForm versionId={versionId} published={!draft} settings={{ ...version, scale_step: Number(version.scale_step) }} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Niveaux de l’échelle" description="Le libellé de chaque note, affiché aux formateurs et aux participants." />
          <CardBody><LevelsForm versionId={versionId} min={version.scale_min} max={version.scale_max} levels={levels ?? []} disabled={!draft} /></CardBody>
        </Card>
        <Card>
          <CardHeader
            title={`Compétences (${(skills ?? []).length})`}
            description="Cliquez sur une compétence pour modifier sa définition, la description de ses niveaux et ses critères d’observation."
            action={draft ? <><CategoryDialog versionId={versionId} /><SkillDialog versionId={versionId} categories={categories ?? []} levels={levelOptions} disabled={false} /></> : null}
          />
          <CardBody className="space-y-5">
            {grouped.map(({ category, skills: list }) => (
              <section key={category?.id ?? 'sans'}>
                <div className="mb-2 flex items-center gap-1">
                  <h3 className="text-sm font-semibold text-ink-muted">{category?.name ?? 'Sans catégorie'}</h3>
                  {category && draft ? <><CategoryDialog versionId={versionId} category={category} /><DeleteCategoryButton versionId={versionId} categoryId={category.id} name={category.name} /></> : null}
                </div>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {list.map((skill) => (
                    <li key={skill.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <SkillDialog
                          versionId={versionId}
                          disabled={!draft}
                          categories={categories ?? []}
                          levels={levelOptions}
                          skill={{
                            ...skill,
                            weight: Number(skill.weight),
                            descriptors: Object.fromEntries(skill.skill_level_descriptors.map((d) => [d.level_value, d.description])),
                            criteria: [...skill.skill_criteria].sort((a, b) => a.position - b.position).map((c) => ({ label: c.label, weight: Number(c.weight) })),
                          }}
                        />
                        <span className="block text-sm text-ink-subtle">
                          {skill.code} · {skill.skill_level_descriptors.length} niveau(x) décrit(s) · {skill.skill_criteria.length} critère(s){!skill.is_active ? ' · inactive' : ''}
                        </span>
                      </span>
                      {draft ? <DeleteSkillButton versionId={versionId} skillId={skill.id} name={skill.name} /> : null}
                    </li>
                  ))}
                  {list.length === 0 ? <li className="px-4 py-3 text-sm text-ink-subtle">Aucune compétence.</li> : null}
                </ul>
              </section>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Correspondances avec les sessions" description="Les compétences proposées au formateur lors de l’évaluation de chaque session. Sans correspondance, toutes les compétences sont proposées." />
          <CardBody className="px-0 sm:px-0">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Compétence</Th>
                    {sessionNumbers.map((n) => <Th key={n} className="text-center">S{n}</Th>)}
                  </tr>
                </thead>
                <tbody>
                  {(skills ?? []).map((skill) => (
                    <Tr key={skill.id}>
                      <Td className="font-medium">{skill.name}</Td>
                      {sessionNumbers.map((n) => (
                        <Td key={n} className="text-center">
                          <MappingCheckbox versionId={versionId} sessionNumber={n} skillId={skill.id} checked={mapped.has(`${n}:${skill.id}`)} disabled={!draft} label={`${skill.name} évaluée en session ${n}`} />
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
