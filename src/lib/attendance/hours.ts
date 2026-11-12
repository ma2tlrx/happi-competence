import { isSignableStatus } from './signature';

/** Durée d'une séance HAPPI quand ni les horaires ni la trame ne la précisent. */
export const DEFAULT_SESSION_MINUTES = 180;

export type RealisationSession = {
  id: string;
  number: number;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled' | string;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
};

function minutesOf(time: string | null) {
  const match = time?.match(/^(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Durée réelle d'une séance : horaires renseignés, sinon durée de la trame du programme, sinon 3 h. */
export function sessionMinutes(session: Pick<RealisationSession, 'startTime' | 'endTime'>, programMinutes?: number | null) {
  const start = minutesOf(session.startTime);
  const end = minutesOf(session.endTime);
  if (start !== null && end !== null && end > start) return end - start;
  return programMinutes && programMinutes > 0 ? programMinutes : DEFAULT_SESSION_MINUTES;
}

export type Realisation = {
  /** Séances terminées où le participant était présent, en retard ou parti plus tôt. */
  realisedMinutes: number;
  /** Séances prévues (hors annulées), complétées par la trame si toutes ne sont pas planifiées. */
  plannedMinutes: number;
  attendedSessions: number;
  completedSessions: number;
  plannedSessions: number;
  firstDate: string | null;
  lastDate: string | null;
  rows: { sessionId: string; number: number; date: string | null; minutes: number; status: string; attendance: string | null; counted: boolean }[];
};

/**
 * Heures réalisées et prévues d'un participant dans un groupe.
 * Un retard ou un départ anticipé compte pour la séance entière (règle à valider avec le financeur).
 */
export function computeRealisation({
  sessions,
  attendance,
  programMinutes,
  programSessionsCount,
}: {
  sessions: RealisationSession[];
  attendance: Map<string, string>;
  programMinutes?: number | null;
  programSessionsCount?: number | null;
}): Realisation {
  const sorted = [...sessions].sort((a, b) => a.number - b.number);
  const active = sorted.filter((session) => session.status !== 'cancelled');
  const rows = sorted.map((session) => {
    const status = attendance.get(session.id) ?? null;
    const minutes = sessionMinutes(session, programMinutes);
    return {
      sessionId: session.id,
      number: session.number,
      date: session.scheduledDate,
      minutes,
      status: session.status,
      attendance: status,
      counted: session.status === 'completed' && isSignableStatus(status),
    };
  });
  const missing = Math.max(0, (programSessionsCount ?? 0) - active.length);
  const fallback = programMinutes && programMinutes > 0 ? programMinutes : DEFAULT_SESSION_MINUTES;
  const dates = active.map((session) => session.scheduledDate).filter((date): date is string => Boolean(date)).sort();
  return {
    realisedMinutes: rows.filter((row) => row.counted).reduce((sum, row) => sum + row.minutes, 0),
    plannedMinutes: rows.filter((row) => row.status !== 'cancelled').reduce((sum, row) => sum + row.minutes, 0) + missing * fallback,
    attendedSessions: rows.filter((row) => row.counted).length,
    completedSessions: rows.filter((row) => row.status === 'completed').length,
    plannedSessions: active.length + missing,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
    rows,
  };
}

/** 18 h · 17 h 30 */
export function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
}
