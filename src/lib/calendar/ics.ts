import { addDays, parisLocalToUtc, type CalendarEvent } from './calendar';

/** Export iCalendar (RFC 5545) des sessions : heures converties en UTC depuis l'heure de Paris. */

export function escapeIcsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Plie une ligne à 75 octets (suite : CRLF + espace), sans couper un caractère multi-octets. */
export function foldLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // l'espace de continuation compte dans les 75 octets
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateOnly = (iso: string) => iso.replace(/-/g, '');

export function buildIcs(events: CalendarEvent[], now = new Date(), name = 'Sessions HAPPI Compétence') {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HAPPI Compétence//Calendrier//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeIcsText(name)}`, 'X-WR-TIMEZONE:Europe/Paris'];
  for (const event of events) {
    lines.push('BEGIN:VEVENT', `UID:session-${event.id}@happi-competence`, `DTSTAMP:${utcStamp(now)}`);
    if (event.startTime) {
      const start = parisLocalToUtc(event.date, event.startTime);
      const end = event.endTime ? parisLocalToUtc(event.date, event.endTime) : new Date(start.getTime() + 3_600_000);
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(event.date)}`, `DTEND;VALUE=DATE:${dateOnly(addDays(event.date, 1))}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(`${event.title} (${event.groupName})`)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    const description = [event.groupName, event.organizationName].filter(Boolean).join(' — ');
    if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    lines.push(`STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
