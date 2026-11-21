/**
 * Observatoire des compétences — axes de découpage et paramètres d'adresse. Module pur, utilisable
 * côté serveur comme côté navigateur.
 *
 * Les catégories sensibles de la fiche d'entrée FSE+ (handicap, RQTH, minorité, origine,
 * nationalité, logement…) ne sont JAMAIS des axes : elles ne figurent pas dans cette liste, ne sont
 * pas lues par l'observatoire et tout paramètre d'adresse qui les viserait est ignoré.
 */
import { AGE_BANDS, ANSWERS, DIPLOMA_LEVELS, GENDERS, LABOUR_STATUSES } from '@/lib/fse/codes';
import { isUuid } from '@/lib/utils';

/** Seuil de confidentialité : en dessous de 5 personnes, une case n'est jamais affichée ni exportée. */
export const MIN_PERSONS = 5;

/** Valeur d'adresse du segment « Non renseigné » (catégorie à part entière, jamais comptée à zéro). */
export const NOT_RECORDED_KEY = 'non-renseigne';

export const AXIS_KEYS = ['organisme', 'ville', 'programme', 'cohorte', 'annee', 'age', 'genre', 'diplome', 'situation', 'qpv'] as const;
export type AxisKey = (typeof AXIS_KEYS)[number];

export const AXIS_LABELS: Record<AxisKey, string> = {
  organisme: 'Organisme',
  ville: 'Ville de la structure',
  programme: 'Programme',
  cohorte: 'Cohorte',
  annee: 'Année d’entrée',
  age: 'Tranche d’âge',
  genre: 'Genre',
  diplome: 'Niveau de diplôme',
  situation: 'Situation à l’entrée',
  qpv: 'Quartier prioritaire (QPV)',
};

type CodedAxis = 'age' | 'genre' | 'diplome' | 'situation' | 'qpv';

/** Axes codés de la fiche d'entrée : codes et libellés de src/lib/fse/codes.ts, dans leur ordre. */
export const CODED_AXES: Record<CodedAxis, Record<string, string>> = {
  age: AGE_BANDS,
  genre: GENDERS,
  diplome: Object.fromEntries(Object.entries(DIPLOMA_LEVELS).map(([code, level]) => [code, `${level.label} (${level.hint})`])),
  situation: Object.fromEntries(Object.entries(LABOUR_STATUSES).map(([code, status]) => [code, status.label])),
  qpv: ANSWERS,
};

export function isCodedAxis(key: AxisKey): key is CodedAxis {
  return key in CODED_AXES;
}

export type ObservatoryFilters = {
  /** Code du référentiel affiché ; null = le premier. */
  framework: string | null;
  /** Une valeur par axe filtré (NOT_RECORDED_KEY pour « non renseigné »). */
  values: Partial<Record<AxisKey, string>>;
  /** Axe de comparaison (« comparer par »), ou aucun. */
  compare: AxisKey | null;
};

const CODE = /^[\w-]{1,80}$/;
const YEAR = /^(19|20)\d{2}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;

function validValue(key: AxisKey, raw: string): string | null {
  if (raw === NOT_RECORDED_KEY) return raw;
  if (key === 'organisme' || key === 'programme' || key === 'cohorte') return isUuid(raw) ? raw : null;
  if (key === 'annee') return YEAR.test(raw) ? raw : null;
  if (key === 'ville') {
    const city = raw.trim();
    return city.length > 0 && city.length <= 120 && !CONTROL.test(city) ? city : null;
  }
  return Object.hasOwn(CODED_AXES[key], raw) ? raw : null;
}

const isAxisKey = (value: unknown): value is AxisKey => typeof value === 'string' && (AXIS_KEYS as readonly string[]).includes(value);

/** Lit les paramètres de l'adresse ; toute valeur mal formée ou inconnue est ignorée. */
export function parseObservatoryParams(params: Record<string, string | string[] | undefined>): { filters: ObservatoryFilters; skill: string | null } {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const values: Partial<Record<AxisKey, string>> = {};
  for (const key of AXIS_KEYS) {
    const raw = one(key);
    const value = typeof raw === 'string' ? validValue(key, raw) : null;
    if (value !== null) values[key] = value;
  }
  const framework = one('referentiel');
  const compare = one('comparer');
  const skill = one('competence');
  return {
    filters: {
      framework: typeof framework === 'string' && CODE.test(framework) ? framework : null,
      values,
      compare: isAxisKey(compare) ? compare : null,
    },
    skill: typeof skill === 'string' && CODE.test(skill) ? skill : null,
  };
}

/** Adresse (partie « ?… ») qui redonne exactement ces filtres ; chaîne vide sans filtre. */
export function observatorySearch(filters: ObservatoryFilters, extra: Record<string, string | null | undefined> = {}): string {
  const params = new URLSearchParams();
  if (filters.framework) params.set('referentiel', filters.framework);
  for (const key of AXIS_KEYS) {
    const value = filters.values[key];
    if (value) params.set(key, value);
  }
  if (filters.compare) params.set('comparer', filters.compare);
  for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
  const search = params.toString();
  return search ? `?${search}` : '';
}
