/** Calendar invite (.ics, METHOD:REQUEST) for a confirmed meeting poll. */

export function buildPollRequestIcs(input: {
  uid: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  location?: string | null;
  url?: string | null;
  organizerEmail: string;
  organizerName: string;
  attendees: Array<{ email: string; name?: string | null }>;
}): string {
  const stamp = formatIcsUtc(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ozer//Meeting Poll//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(input.uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatIcsUtc(new Date(input.startAt))}`,
    `DTEND:${formatIcsUtc(new Date(input.endAt))}`,
    `SUMMARY:${escapeIcs(input.title)}`,
    `DESCRIPTION:${escapeIcs(input.description)}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    `ORGANIZER;CN=${escapeIcs(input.organizerName)}:mailto:${escapeIcs(input.organizerEmail)}`,
  ];

  if (input.location) {
    lines.push(`LOCATION:${escapeIcs(input.location)}`);
  }

  if (input.url) {
    lines.push(`URL:${escapeIcs(input.url)}`);
  }

  for (const attendee of input.attendees) {
    const cn = attendee.name?.trim()
      ? `;CN=${escapeIcs(attendee.name.trim())}`
      : '';
    lines.push(
      `ATTENDEE${cn};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${escapeIcs(attendee.email)}`,
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldIcsLine).join('\r\n');
}

export function pollIcsAttachment(ics: string) {
  return {
    name: 'meeting.ics',
    content: Buffer.from(ics, 'utf8').toString('base64'),
    mimeType: 'text/calendar; method=REQUEST; charset=UTF-8',
  };
}

function formatIcsUtc(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** RFC 5545: fold at 75 octets, not JavaScript characters. */
function foldIcsLine(line: string) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let offset = 0;
  let budget = 75;

  while (offset < bytes.length) {
    let end = Math.min(offset + budget, bytes.length);

    if (end < bytes.length) {
      while (end > offset && (bytes[end]! & 0xc0) === 0x80) {
        end -= 1;
      }

      if (end === offset) {
        end = Math.min(offset + 1, bytes.length);
        while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) {
          end += 1;
        }
      }
    }

    const chunk = bytes.subarray(offset, end).toString('utf8');
    parts.push(offset === 0 ? chunk : ` ${chunk}`);
    offset = end;
    budget = 74;
  }

  return parts.join('\r\n');
}
