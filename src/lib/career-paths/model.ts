/**
 * Pistes métiers du bilan HAPPI : trois pistes à explorer, calculées sans IA à partir des
 * points d'appui observés, des correspondances HAPPI ↔ savoir-être ROME VALIDÉES par un
 * administrateur et des secteurs que la personne a elle-même déclarés.
 *
 * Ce sont des recommandations, jamais un verdict : aucun score n'est affiché, aucune note
 * n'est modifiée. Règles documentées dans docs/pistes-metiers.md.
 */

/** Version des règles du moteur. À incrémenter si une règle change ; les bilans existants gardent leurs pistes. */
export const CAREER_PATHS_ENGINE_VERSION = 'pistes-1.0';

/** Nombre de pistes présentées (choix du propriétaire : trois, pour rester impartial). */
export const CAREER_PATHS_COUNT = 3;

/** D'où vient une piste. */
export type CareerPathBasis =
  /**
   * Dans un secteur que la personne a déclaré viser (questionnaire d'accueil). Le libellé du secteur n'est
   * JAMAIS conservé dans le bilan : le questionnaire n'est pas lisible par l'organisme, le bilan validé l'est.
   */
  | 'declared_sector'
  /** Hors des secteurs déclarés : une ouverture, pour ne pas enfermer la personne dans ses premiers choix. */
  | 'opening'
  /** Aucun secteur déclaré : pistes issues des seuls points d'appui, dans trois grands domaines différents. */
  | 'strengths';

/** Un savoir-être ROME sur lequel la piste s'appuie, et les compétences HAPPI observées qui y mènent. */
export type CareerPathAnchor = {
  /** Code ROME du savoir-être (ex. « 6D108 »). */
  code: string;
  label: string;
  /** Noms des compétences HAPPI (points d'appui) reliées à ce savoir-être par une correspondance validée. */
  happiSkills: string[];
};

export type CareerPath = {
  basis: CareerPathBasis;
  /** Grand domaine ROME (lettre, ex. « K ») et son libellé officiel. */
  domain: { code: string; label: string };
  /** Domaine professionnel ROME (ex. « K12 ») et son libellé officiel. */
  subdomain: { code: string; label: string };
  /** Fiche ROME la plus proche dans ce domaine professionnel (code, ex. « K1205 »). */
  ficheCode: string;
  /** Quelques appellations officielles de la fiche, pour donner des exemples concrets de métiers. */
  examples: string[];
  /** Savoir-être de la fiche qui rejoignent les points d'appui de la personne (au moins un). */
  anchors: CareerPathAnchor[];
};

/** Pourquoi aucune piste n'est proposée (message clair dans le bilan, jamais de piste « au hasard »). */
export type CareerPathsUnavailable =
  /** Aucune correspondance HAPPI ↔ ROME validée par un administrateur. */
  | 'no_validated_mappings'
  /** Pas assez de compétences observées pour dégager des points d'appui (règle existante du moteur d'évaluation). */
  | 'no_strengths'
  /** Les points d'appui ne sont reliés à aucun savoir-être ROME validé. */
  | 'no_anchors'
  /** Référentiel ROME absent de la base. */
  | 'no_reference';

export type CareerPaths = {
  engineVersion: string;
  /** Source citée : « ROME 4.0 (France Travail), version 26M10 ». */
  source: string;
  status: 'ok' | 'unavailable';
  reason: CareerPathsUnavailable | null;
  paths: CareerPath[];
  /** Points d'appui (compétences HAPPI) utilisés, pour la transparence. */
  strengths: string[];
};
