import 'server-only';

import type { CurrentUser } from '@/lib/auth/session';

import type { CalendarSpace } from './queries';

/** Espace de calendrier d'un compte (le rôle décide ; la sécurité des lignes reste le vrai garde-fou). */
export function calendarSpaceFor(user: Pick<CurrentUser, 'role'>): CalendarSpace {
  return user.role === 'admin' ? 'admin' : user.role === 'formateur' ? 'formateur' : user.role === 'organisme' ? 'organisme' : 'participant';
}

export const CALENDAR_PATH: Record<CalendarSpace, string> = {
  admin: '/admin/calendrier',
  formateur: '/formateur/calendrier',
  organisme: '/organisme/calendrier',
  participant: '/participant/calendrier',
};
