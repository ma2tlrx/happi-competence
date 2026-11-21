/**
 * Carte du parcours et album des compétences : deux lectures « jeu » de données existantes.
 * Module pur (serveur et navigateur).
 */

export type JourneySessionInput = {
  number: number;
  title: string;
  date: string | null;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  attendance: string | null;
};

/**
 * État d'une étape du parcours.
 * - `attended` : session terminée, la personne était là (retard et départ anticipé compris).
 * - `passed` : session terminée sans présence enregistrée pour elle. Affichée sans reproche : l'étape est passée, c'est tout.
 * - `current` : session en cours, ou prochaine session prévue.
 * - `upcoming` : à venir. `cancelled` : annulée.
 */
export type StationState = 'attended' | 'passed' | 'current' | 'upcoming' | 'cancelled';

export type JourneyStation = {
  number: number;
  title: string | null;
  date: string | null;
  state: StationState;
  isLast: boolean;
};

const ATTENDED = new Set(['present', 'late', 'left_early']);

export function buildJourney(sessions: readonly JourneySessionInput[], total: number): { stations: JourneyStation[]; currentNumber: number | null; finished: boolean } {
  const count = Math.max(total, ...sessions.map((session) => session.number), 1);
  const byNumber = new Map(sessions.map((session) => [session.number, session]));
  const inProgress = sessions.find((session) => session.status === 'in_progress');
  const nextPlanned = [...sessions].filter((session) => session.status === 'planned').sort((a, b) => a.number - b.number)[0];
  const currentNumber = inProgress?.number ?? nextPlanned?.number ?? null;
  const stations = Array.from({ length: count }, (_, index): JourneyStation => {
    const number = index + 1;
    const session = byNumber.get(number);
    let state: StationState = 'upcoming';
    if (session?.status === 'cancelled') state = 'cancelled';
    else if (session?.status === 'completed') state = session.attendance && ATTENDED.has(session.attendance) ? 'attended' : 'passed';
    else if (number === currentNumber) state = 'current';
    return { number, title: session?.title ?? null, date: session?.date ?? null, state, isLast: number === count };
  });
  const finished = sessions.length > 0 && stations.every((station) => station.state === 'attended' || station.state === 'passed' || station.state === 'cancelled');
  return { stations, currentNumber, finished };
}

export type CollectionSkill = { code: string; name: string; revealed: boolean; progressed: boolean; href: string };
export type CollectionGroup = { code: string; name: string; shortName: string; skills: CollectionSkill[]; revealed: number };

type FrameworkInput = {
  code: string;
  name: string;
  shortName: string;
  skills: { code: string; name: string; summary: { value: number | null; delta: number | null } }[];
};

/** Page de détail de chaque référentiel dans l'espace participant. */
export function frameworkPath(code: string) {
  return code === 'sociocognitive' ? '/participant/habiletes-sociocognitives' : '/participant/competences-transversales';
}

/**
 * Album des compétences : une case par compétence du référentiel. Une compétence est « révélée »
 * dès sa première observation validée, quel que soit le niveau observé ; sinon elle reste « à découvrir ».
 * La progression suit la règle du moteur d'évaluation (dernière observation au-dessus de la première).
 */
export function buildCollection(frameworks: readonly FrameworkInput[]): { groups: CollectionGroup[]; revealed: number; total: number; progressions: number } {
  const groups = frameworks.map((framework) => {
    const skills = framework.skills.map((skill) => ({
      code: skill.code,
      name: skill.name,
      revealed: skill.summary.value !== null,
      progressed: (skill.summary.delta ?? 0) > 0,
      href: `${frameworkPath(framework.code)}#competence-${skill.code}`,
    }));
    return { code: framework.code, name: framework.name, shortName: framework.shortName, skills, revealed: skills.filter((skill) => skill.revealed).length };
  });
  const all = groups.flatMap((group) => group.skills);
  return {
    groups,
    revealed: all.filter((skill) => skill.revealed).length,
    total: all.length,
    progressions: all.filter((skill) => skill.progressed).length,
  };
}
