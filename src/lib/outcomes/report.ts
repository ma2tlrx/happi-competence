import 'server-only';

import { hasPermission, type CurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/trainer';
import { isUuid } from '@/lib/utils';

import { buildImpactReport, filterDataset, type ImpactFilters, type ImpactReport } from './impact';
import { loadImpactDataset } from './load';

export type ImpactAccess = {
  report: ImpactReport;
  filters: ImpactFilters;
  programs: { id: string; name: string }[];
  organizations: { id: string; name: string }[];
  /** Données que le rôle ne peut pas lire : affichées « non disponible », jamais calculées à zéro. */
  unavailable: { attendance: boolean; progression: boolean };
};

const isoDate = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

export function parseImpactFilters(params: Record<string, string | string[] | undefined>): ImpactFilters {
  const one = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key]);
  return {
    from: isoDate(one('du')),
    to: isoDate(one('au')),
    programId: isUuid(one('programme')) ? (one('programme') as string) : null,
    organizationId: isUuid(one('organisme')) ? (one('organisme') as string) : null,
  };
}

/** Vrai si l'utilisateur peut consulter le tableau de bord d'impact. */
export function canReadImpact(user: CurrentUser) {
  return user.role === 'admin' || (user.role === 'organisme' && user.organization?.status === 'active' && hasPermission(user, 'org.impact.read'));
}

/**
 * Rapport d'impact selon le rôle : l'administrateur voit tout (filtre organisme possible) ;
 * un organisme ne voit que les parcours de ses propres participants (RLS + filtre explicite).
 */
export async function loadImpactFor(user: CurrentUser, rawFilters: ImpactFilters): Promise<ImpactAccess | null> {
  if (!canReadImpact(user)) return null;
  const supabase = await createClient();
  const organizationId = user.role === 'organisme' ? user.organization!.id : null;
  const filters: ImpactFilters = { ...rawFilters, organizationId: organizationId ?? rawFilters.organizationId ?? null };
  const dataset = await loadImpactDataset(supabase, { organizationId });
  const programs = new Map(dataset.groups.map((group) => [group.programId, group.programName]));
  const organizations = new Map(
    dataset.participants.filter((participant) => participant.organizationId).map((participant) => [participant.organizationId!, participant.organizationName ?? '']),
  );
  const report = buildImpactReport(filterDataset(dataset, filters), todayIso());
  return {
    report,
    filters,
    programs: [...programs].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    organizations: [...organizations].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    unavailable: {
      attendance: user.role === 'organisme' && !hasPermission(user, 'org.attendance.read'),
      progression: user.role === 'organisme' && !hasPermission(user, 'org.evaluations.read'),
    },
  };
}
