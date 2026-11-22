import 'server-only';

import type { ReportData } from '@/lib/report/model';
import type { ServerClient } from '@/lib/supabase/server';

import { computeCareerPaths, type CareerPathsInputs, type LinkType, type RomeReference } from './engine';
import type { CareerPaths } from './model';

/** Référentiel externe des savoir-être (import `rome_savoir_etre`, voir docs/referentiels-publics.md). */
export const ROME_SAVOIR_ETRE_SOURCE = 'rome_savoir_etre';
const PAGE = 1000;

/**
 * Lit toutes les lignes d'une requête paginée et triée. On avance du nombre de lignes réellement reçues
 * et on s'arrête sur une page vide : correct même si le serveur plafonne les pages sous 1 000 lignes.
 */
async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error || !data) return null;
    if (data.length === 0) return rows;
    rows.push(...data);
    from += data.length;
  }
}

async function loadReference(supabase: ServerClient): Promise<RomeReference | null> {
  const [domains, fiches, links] = await Promise.all([
    readAll((from, to) => supabase.from('rome_domains').select('code, label').order('code').range(from, to)),
    readAll((from, to) => supabase.from('rome_fiches').select('code, appellations').order('code').range(from, to)),
    readAll((from, to) => supabase.from('rome_fiche_savoir_etre').select('fiche_code, savoir_etre_code').order('fiche_code').order('savoir_etre_code').range(from, to)),
  ]);
  if (!domains || !fiches || !links) return null;
  const savoirEtre = new Map<string, string[]>();
  for (const link of links) savoirEtre.set(link.fiche_code, [...(savoirEtre.get(link.fiche_code) ?? []), link.savoir_etre_code]);
  return {
    domains: Object.fromEntries(domains.map((domain) => [domain.code, domain.label])),
    fiches: fiches.map((fiche) => ({ code: fiche.code, appellations: fiche.appellations ?? [], savoirEtre: savoirEtre.get(fiche.code) ?? [] })),
  };
}

type MappingRow = {
  skill_code: string;
  link_type: string;
  frameworks: { code: string } | null;
  external_skills: { code: string; label: string; external_frameworks: { code: string; name: string; version: string; publisher: string } | null } | null;
};

/**
 * Pistes métiers d'un bilan, calculées sous les droits de l'appelant (formateur du participant ou
 * administrateur). En cas d'erreur de lecture, renvoie null : le bilan se génère sans la section.
 */
export async function loadCareerPaths(supabase: ServerClient, participantId: string, data: ReportData): Promise<CareerPaths | null> {
  try {
    const [rows, intakeResult, reference] = await Promise.all([
      // Correspondances VALIDÉES vers les savoir-être ROME seulement, filtrées et paginées par la base.
      readAll((from, to) =>
        supabase
          .from('skill_mappings')
          .select('id, skill_code, link_type, frameworks!inner ( code ), external_skills!inner ( code, label, external_frameworks!inner ( code, name, version, publisher ) )')
          .eq('status', 'validated')
          .eq('external_skills.external_frameworks.code', ROME_SAVOIR_ETRE_SOURCE)
          .in('link_type', ['equivalent', 'close', 'partial'])
          .order('id')
          .range(from, to),
      ),
      supabase.from('participant_intakes').select('sectors').eq('participant_id', participantId).maybeSingle(),
      loadReference(supabase),
    ]);
    // Une erreur de lecture ne doit pas être figée dans un bilan immuable : la section est alors omise.
    if (!rows || intakeResult.error || !reference) return null;

    const rome = (rows as unknown as MappingRow[]).filter((row) => row.external_skills?.external_frameworks?.code === ROME_SAVOIR_ETRE_SOURCE);
    const sourceRow = rome[0]?.external_skills?.external_frameworks;
    const mappings: CareerPathsInputs['mappings'] = rome.flatMap((row) =>
      row.frameworks && row.external_skills && ['equivalent', 'close', 'partial'].includes(row.link_type)
        ? [{ frameworkCode: row.frameworks.code, skillCode: row.skill_code, savoirEtreCode: row.external_skills.code, savoirEtreLabel: row.external_skills.label, linkType: row.link_type as LinkType }]
        : [],
    );

    return computeCareerPaths({
      frameworks: data.frameworks.map((framework) => ({
        code: framework.code,
        insufficient: framework.highlights.insufficient,
        strengths: framework.highlights.strengths,
        skills: framework.skills.map((skill) => ({ code: skill.code, name: skill.name })),
      })),
      mappings,
      reference,
      declaredSectors: intakeResult.data?.sectors ?? [],
      source: sourceRow ? `${sourceRow.name} (${sourceRow.publisher}), ${sourceRow.version}` : 'ROME 4.0 (France Travail)',
    });
  } catch (error) {
    console.error('Pistes métiers indisponibles', error instanceof Error ? error.message : 'erreur inconnue');
    return null;
  }
}
