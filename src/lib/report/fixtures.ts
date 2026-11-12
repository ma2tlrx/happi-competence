/**
 * Passeports de test pour les scénarios de bilan (tests unitaires et rendu PDF de contrôle).
 * Structure identique à celle du référentiel publié ; valeurs fixées par scénario.
 */
import { highlights, levelFor, summarizeProfile, type FrameworkRules, type Observation } from '@/lib/evaluation-engine';
import type { Passport, PassportFramework } from '@/lib/passport';

const RULES_CT: FrameworkRules = { scaleMin: 1, scaleMax: 5, scaleStep: 1, scoringMode: 'direct', aggregation: 'latest', rounding: 'none' };
const RULES_HBS: FrameworkRules = { ...RULES_CT, scaleMax: 4 };

const CT_LEVELS = ['Non acquis', 'En difficulté', 'En cours d’acquisition', 'Acquis', 'Dépassé'];
const HBS_LEVELS = ['Aptitude', 'Acquisition', 'Maîtrise', 'Excellence'];

const CT = [
  ['communication', 'Communication', ['relationnel:Relationnel', 'esprit_d_equipe:Esprit d’équipe', 'comprehension:Compréhension']],
  ['gestion_du_stress', 'Gestion du stress', ['adaptabilite:Adaptabilité', 'gestion_des_priorites:Gestion des priorités', 'gestion_du_stress:Gestion du stress']],
  ['leadership', 'Leadership', ['leadership:Leadership', 'force_de_proposition:Force de proposition', 'organisation:Organisation']],
  ['analyse_des_problemes', 'Analyse des problèmes', ['implication:Implication', 'analyse_des_problemes:Analyse des problèmes', 'curiosite:Curiosité']],
  ['autonomie_et_competitivite', 'Autonomie et compétitivité', ['autonomie:Autonomie', 'respect_des_delais:Respect des délais', 'polyvalence:Polyvalence']],
  ['humaine', 'Humaine', ['respect_des_consignes:Respect des consignes', 'professionnalisme:Professionnalisme', 'rigueur:Rigueur']],
] as const;
const HBS = [
  ['soi', 'Soi', ['auto_evaluation:Auto-évaluation', 'auto_regulation:Auto-régulation', 'auto_organisation:Auto-organisation', 'auto_mobilisation:Auto-mobilisation']],
  ['autre', 'Autre', ['sensibilite_sociale:Sensibilité sociale', 'adaptation_relationnelle:Adaptation relationnelle', 'cooperation:Coopération']],
  ['action', 'Action', ['raisonnement_logique:Raisonnement logique', 'planification:Planification', 'arbitrage:Arbitrage']],
  ['savoir', 'Savoir', ['traitement_de_l_information:Traitement de l’information', 'synthese:Synthèse', 'conceptualisation:Conceptualisation']],
  ['complexite', 'Complexité', ['flexibilite_mentale:Flexibilité mentale', 'projection:Projection', 'approche_globale:Approche globale']],
] as const;

export type FixtureScores = Record<string, Array<[session: number, score: number, comment?: string]>>;

function framework(code: 'transversal' | 'sociocognitive', scores: FixtureScores): PassportFramework {
  const definition = code === 'transversal' ? CT : HBS;
  const rules = code === 'transversal' ? RULES_CT : RULES_HBS;
  const levels = (code === 'transversal' ? CT_LEVELS : HBS_LEVELS).map((label, index) => ({ value: index + 1, label, description: null }));
  const skills = definition.flatMap(([categoryCode, , members]) => members.map((member) => ({ categoryCode, code: member.split(':')[0]!, name: member.split(':')[1]! })));
  const observations: Observation[] = [];
  for (const skill of skills) {
    for (const [session, score, comment] of scores[skill.code] ?? []) {
      observations.push({ skillCode: skill.code, score, sessionNumber: session, date: `2026-0${session}-10`, comment: comment ?? null });
    }
  }
  const summaries = summarizeProfile(skills.map((skill) => skill.code), observations, rules);
  const passportSkills = skills.map((skill, index) => {
    const summary = summaries.get(skill.code)!;
    return {
      id: `${code}-${index}`,
      code: skill.code,
      name: skill.name,
      description: code === 'sociocognitive' ? `Habileté « ${skill.name} » (définition du référentiel).` : null,
      categoryCode: skill.categoryCode,
      levels: levels.map((level) => ({ value: level.value, description: `${skill.name} — niveau « ${level.label} ».` })),
      summary,
      level: levelFor(summary.value, levels),
      selfValue: null,
      selfQuestion: null,
      lastComment: null,
    };
  });
  return {
    code,
    name: code === 'transversal' ? 'Compétences transversales' : 'Habiletés socio-cognitives',
    shortName: code === 'transversal' ? 'Transversales' : 'Habiletés',
    description: null,
    versionLabel: '1',
    isProvisional: code === 'transversal',
    rules,
    levels,
    categories: definition.map(([categoryCode, name]) => ({
      code: categoryCode,
      name,
      description: null,
      skills: passportSkills.filter((skill) => skill.categoryCode === categoryCode),
    })),
    skills: passportSkills,
    highlights: highlights(passportSkills.map((skill) => skill.summary)),
    observedCount: passportSkills.filter((skill) => skill.summary.value !== null).length,
    selfComparable: false,
  };
}

const TITLES = ['La communication', 'Adaptabilité et gestion du stress', 'Leadership', 'Analyse des problèmes', 'Autonomie et compétitivité', 'Thème à préciser'];

export function fixturePassport({
  ct = {},
  hbs = {},
  attended = [],
  evaluated = [],
  feedback = {},
  withGroup = true,
}: {
  ct?: FixtureScores;
  hbs?: FixtureScores;
  attended?: number[];
  evaluated?: number[];
  feedback?: Record<number, { observation?: string; advice?: string }>;
  withGroup?: boolean;
}): Passport {
  const sessions = withGroup
    ? TITLES.map((title, index) => ({
        id: `s${index + 1}`,
        number: index + 1,
        title,
        date: `2026-0${index + 1}-10`,
        startTime: null,
        endTime: null,
        location: null,
        status: 'completed' as const,
        attendance: attended.includes(index + 1) ? 'present' : index + 1 <= Math.max(0, ...attended) ? 'absent' : null,
        evaluated: evaluated.includes(index + 1),
        programSessionId: `ps${index + 1}`,
      }))
    : [];
  return {
    participant: { id: 'p1', firstName: 'Camille', lastName: 'Exemple', email: null, hasAccount: true, createdAt: '2026-01-01', organization: { id: 'o1', name: 'Mission Locale d’exemple' } },
    group: withGroup ? { id: 'g1', name: 'Groupe test', status: 'active', startDate: '2026-01-10', endDate: '2026-06-10', programName: 'Programme HAPPI', sessionsCount: 6, trainers: ['Formateur Test'] } : null,
    otherGroups: [],
    sessions,
    completedSessions: evaluated.length,
    attendedSessions: attended.length,
    nextSession: null,
    currentSession: null,
    evaluations: evaluated.map((number) => ({
      id: `e${number}`,
      sessionId: `s${number}`,
      sessionNumber: number,
      sessionTitle: TITLES[number - 1]!,
      date: `2026-0${number}-10`,
      validatedAt: `2026-0${number}-11`,
      evaluator: 'Formateur Test',
      revision: 0,
      observation: feedback[number]?.observation ?? null,
      advice: feedback[number]?.advice ?? null,
      scoreCount: 3,
    })),
    frameworks: [framework('transversal', ct), framework('sociocognitive', hbs)],
    selfAssessment: null,
    finalSelfAssessment: null,
    lastEvaluationAt: null,
  };
}

export const SUPPORT_SESSION_1 = `# Session 1\n## Objectifs\n## Accueil & Présentation\n## Icebreaker — Jeu de l'Imposteur\n## Débat thématique — Questions OUI / NON\n## Pause\n## Activités Ludiques — Moving Out & WorldGuessr\n## Conclusion\n`;

/** Texte d'exemple pour les rendus de contrôle : volontairement long, pour éprouver la mise en page. */
export function fixtureContent(data: import('./model').ReportData, long = false): import('./content').ReportContent {
  const lorem = (base: string) => (long ? `${base} ${base} ${base}` : base);
  const observed = data.frameworks.flatMap((framework) => framework.skills.filter((skill) => skill.status !== 'not_observed'));
  const evaluated = data.sessions.filter((session) => session.evaluated).map((session) => session.number);
  return {
    introduction: lorem('Ce bilan présente ce que les formateurs ont observé pendant votre parcours HAPPI.') + '\n\n' + lorem('Les niveaux sont des repères situés, pas une vérité définitive.'),
    profile: { summary: lorem('Vous vous appuyez sur la coopération et l’écoute.'), traits: evaluated.slice(0, 3).map((n) => lorem(`Lors de la session ${n}, vous avez pris part aux échanges du groupe.`)) },
    frameworks: data.frameworks.filter((f) => f.observedCount).map((f) => ({ code: f.code, summary: lorem(`Lecture du référentiel ${f.name.toLowerCase()}.`) })),
    behaviour: {
      summary: lorem('En situation de jeu, vous vous impliquez dans les activités collectives.'),
      themes: evaluated.length ? [{ theme: 'cooperation', text: lorem('Vous répartissez les rôles et vérifiez que chacun a compris.'), sessions: [evaluated[0]!] }, { theme: 'consignes', text: lorem('Vous relisez les consignes avant d’agir.'), sessions: evaluated.slice(0, 2) }] : [],
    },
    skills: observed.map((skill) => ({
      code: skill.code,
      observed: lorem(`Les formateurs ont observé « ${skill.name} » pendant les activités.`),
      strengths: lorem('Vous savez vous appuyer sur le groupe.'),
      progress: lorem('Prendre l’initiative plus tôt dans l’activité.'),
      professional: lorem('Utile dans tout travail d’équipe.'),
    })),
    recommendations: observed.slice(0, 4).map((skill, index) => ({
      skillCode: skill.code,
      priority: (['valoriser', 'consolider', 'developper', 'consolider'] as const)[index]!,
      why: lorem('Cette compétence ressort des observations.'),
      action: lorem('Proposer d’animer un temps d’échange.'),
      exercise: lorem('Mener une partie coopérative en tant que coordinateur.'),
      worksOn: lorem('La prise de parole et l’organisation.'),
      goal: lorem('Coordonner une activité de bout en bout.'),
    })),
    conclusion: lorem('Votre parcours montre un engagement réel.') + '\n\n' + lorem('Les pistes proposées vous aideront à aller plus loin.'),
    closing: 'Vos compétences se voient quand vous jouez : continuez à les mettre en jeu.',
    limits: lorem('Ce bilan repose sur un nombre limité de sessions.'),
    dataWarnings: [],
  };
}
