import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import { isRole, ROLE_HOME, type OrganizationStatus, type PermissionCode, type Role } from './roles';

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: 'active' | 'disabled';
  isDemo: boolean;
  /** Fiche participant liée au compte (rôle participant). */
  participantId: string | null;
  /** Structure de rattachement (rôle organisme). */
  organization: { id: string; name: string; status: OrganizationStatus; memberRole: 'owner' | 'member' } | null;
  permissions: PermissionCode[];
  /** Compte créé pour un accès professionnel mais dont le code n'a pas encore été activé. */
  awaitingAccessCode: boolean;
};

/**
 * Utilisateur courant, vérifié auprès du serveur d'authentification.
 * Mis en cache pour la durée de la requête : plusieurs appels ne coûtent qu'une lecture.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile || !isRole(profile.role)) return null;

  const [participant, membership, permissions] = await Promise.all([
    profile.role === 'participant'
      ? supabase.from('participants').select('id').eq('user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    profile.role === 'organisme'
      ? supabase
          .from('organization_members')
          .select('member_role, organizations ( id, name, status )')
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('role_permissions').select('permission_code').eq('role_code', profile.role),
  ]);

  const organization = membership.data?.organizations
    ? {
        id: membership.data.organizations.id,
        name: membership.data.organizations.name,
        status: membership.data.organizations.status as OrganizationStatus,
        memberRole: membership.data.member_role as 'owner' | 'member',
      }
    : null;

  return {
    id: user.id,
    email: profile.email,
    role: profile.role,
    firstName: profile.first_name,
    lastName: profile.last_name,
    phone: profile.phone,
    status: profile.status as 'active' | 'disabled',
    isDemo: profile.is_demo,
    participantId: participant.data?.id ?? null,
    organization,
    permissions: (permissions.data ?? []).map((row) => row.permission_code as PermissionCode),
    awaitingAccessCode:
      profile.role === 'participant' && !participant.data && user.user_metadata?.account_type === 'pro',
  };
});

/** Page d'accueil de l'espace correspondant au compte. */
export function homePathFor(user: CurrentUser) {
  if (user.status !== 'active') return '/compte-desactive';
  if (user.awaitingAccessCode) return '/acces-pro';
  return ROLE_HOME[user.role];
}

/** Exige un utilisateur connecté et actif. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');
  if (user.status !== 'active') redirect('/compte-desactive');
  return user;
}

/**
 * Exige l'un des rôles indiqués. Un utilisateur d'un autre rôle est renvoyé vers
 * son propre espace. L'administrateur a accès à l'espace formateur.
 */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.awaitingAccessCode) redirect('/acces-pro');
  if (!roles.includes(user.role)) redirect(homePathFor(user));
  return user;
}

export function hasPermission(user: CurrentUser, permission: PermissionCode) {
  return user.role === 'admin' || user.permissions.includes(permission);
}
