import type { Role } from './roles';

/** Espace visé depuis le site (paramètre ?espace=). */
export type Space = 'participant' | 'organisme' | 'formateur' | 'admin';

export const SPACES: Record<Space, { title: string; intro: string; role: Role; canSignUp: boolean }> = {
  participant: {
    title: 'Espace participant',
    intro: 'Retrouvez votre parcours et votre passeport de compétences.',
    role: 'participant',
    canSignUp: true,
  },
  organisme: {
    title: 'Espace organisme',
    intro: 'Suivez les participants rattachés à votre structure.',
    role: 'organisme',
    canSignUp: true,
  },
  formateur: {
    title: 'Espace formateur',
    intro: 'Animez vos sessions, saisissez les présences et les évaluations.',
    role: 'formateur',
    canSignUp: false,
  },
  admin: {
    title: 'Administration',
    intro: 'Gérez la plateforme HAPPI.',
    role: 'admin',
    canSignUp: false,
  },
};

export function parseSpace(value: string | string[] | undefined): Space {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw in SPACES ? (raw as Space) : 'participant';
}
