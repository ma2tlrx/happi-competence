/**
 * Données d'un bilan HAPPI : photographie des résultats d'un participant, calculée
 * une seule fois à la création du bilan puis conservée telle quelle (colonne
 * participant_reports.data). Tout ce que le bilan affiche en chiffres vient d'ici ;
 * la rédaction (IA ou formateur) ne fait qu'interpréter ces valeurs.
 */

/** Version des règles de construction du bilan. À incrémenter si une règle ci-dessous change. */
export const REPORT_ENGINE_VERSION = 'bilan-1.0';

/** Statut d'observation d'une compétence (règle documentée dans docs/bilans.md). */
export type ReportSkillStatus = 'not_observed' | 'single' | 'repeated';

export type ReportObservation = {
  session: number;
  sessionTitle: string;
  date: string | null;
  value: number;
  levelLabel: string | null;
  /** Commentaire du formateur sur cette compétence, pour cette session (partagé avec le participant). */
  comment: string | null;
};

export type ReportSkill = {
  code: string;
  name: string;
  description: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  /** Valeur retenue selon la règle de synthèse du référentiel ; nulle si jamais observée. */
  value: number | null;
  levelValue: number | null;
  levelLabel: string | null;
  /** Description officielle du niveau atteint pour cette compétence, si le référentiel en fournit une. */
  levelDescriptor: string | null;
  status: ReportSkillStatus;
  observations: ReportObservation[];
  first: number | null;
  last: number | null;
  delta: number | null;
  trend: 'up' | 'down' | 'stable' | null;
  /** Auto-évaluation initiale, seulement si son échelle est celle du référentiel. */
  self: { value: number; label: string | null } | null;
};

export type ReportCategory = {
  code: string;
  name: string;
  description: string | null;
  skillCodes: string[];
  observed: number;
  total: number;
  /** Nombre de compétences de la catégorie par niveau atteint. */
  distribution: { value: number; count: number }[];
};

export type ReportFramework = {
  code: string;
  name: string;
  shortName: string;
  description: string | null;
  versionLabel: string;
  isProvisional: boolean;
  scaleMin: number;
  scaleMax: number;
  levels: { value: number; label: string; description: string | null }[];
  rules: { scoringMode: string; scoringLabel: string; aggregation: string; aggregationLabel: string };
  categories: ReportCategory[];
  skills: ReportSkill[];
  observedCount: number;
  totalCount: number;
  repeatedCount: number;
  distribution: { value: number; label: string; count: number }[];
  /** Points saillants calculés par le moteur d'évaluation (codes de compétences). */
  highlights: { strengths: string[]; toDevelop: string[]; progressions: string[]; insufficient: boolean };
  /** Écart entre le niveau le plus haut et le plus bas observés ; nul si moins de deux compétences observées. */
  spread: number | null;
  /** Lecture du profil : `homogeneous` (écart ≤ 1 niveau), `contrasted` (écart ≥ 2), `undetermined` (trop peu d'observations). */
  shape: 'homogeneous' | 'contrasted' | 'undetermined';
  selfComparable: boolean;
};

export type ReportSession = {
  number: number;
  title: string;
  date: string | null;
  attendance: string | null;
  attended: boolean;
  evaluated: boolean;
  /** Activités prévues au déroulé pédagogique de la session (support publié). */
  activities: string[];
};

export type ReportFeedback = { session: number; title: string; date: string | null; observation: string | null; advice: string | null };

export type ReportData = {
  engineVersion: string;
  generatedAt: string;
  participant: { firstName: string; lastName: string };
  organization: string | null;
  program: { name: string; sessionsCount: number } | null;
  group: { name: string; startDate: string | null; endDate: string | null; trainers: string[] } | null;
  sessions: ReportSession[];
  counts: {
    sessionsPlanned: number;
    sessionsAttended: number;
    sessionsEvaluated: number;
    activities: number;
    observations: number;
    skillsObserved: number;
    skillsTotal: number;
  };
  frameworks: ReportFramework[];
  feedback: ReportFeedback[];
  selfAssessment: { completedAt: string | null; comment: string | null } | null;
  /** `none` : aucune observation ; `limited` : trop peu pour dégager des tendances ; `sufficient` sinon. */
  sufficiency: 'none' | 'limited' | 'sufficient';
  /** Données manquantes, en clair, affichées dans l'interface et dans le bilan. */
  missing: string[];
};
