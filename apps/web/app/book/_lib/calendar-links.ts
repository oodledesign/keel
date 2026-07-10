/** Build a valid .ics file for confirmation UI and email attachment (UTC). */

export function buildBookingIcs(input: {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  location?: string | null;
  url?: string | null;
  /** Stable across resends; defaults to a booking-derived id when provided */
  uid?: string;
  organizerEmail?: string | null;
  organizerName?: string | null;
  attendeeEmail?: string | null;
  attendeeName?: string | null;
}): string {
  const stamp = formatIcsUtc(new Date());
  const start = formatIcsUtc(new Date(input.startAt));
  const end = formatIcsUtc(new Date(input.endAt));
  const uid =
    input.uid?.trim() ||
    `${start}-${hashSeed(input.title + input.startAt)}@ozer.so`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ozer//Scheduling//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(input.title)}`,
    `DESCRIPTION:${escapeIcs(foldDescription(input.description))}`,
  ];

  if (input.location) {
    lines.push(`LOCATION:${escapeIcs(input.location)}`);
  }
  if (input.url) {
    lines.push(`URL:${escapeIcs(input.url)}`);
  }
  if (input.organizerEmail) {
    const cn = input.organizerName
      ? `;CN=${escapeIcs(input.organizerName)}`
      : '';
    lines.push(`ORGANIZER${cn}:mailto:${escapeIcs(input.organizerEmail)}`);
  }
  if (input.attendeeEmail) {
    const cn = input.attendeeName
      ? `;CN=${escapeIcs(input.attendeeName)}`
      : '';
    lines.push(
      `ATTENDEE${cn};RSVP=FALSE:mailto:${escapeIcs(input.attendeeEmail)}`,
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function googleCalendarTemplateUrl(input: {
  title: string;
  details: string;
  startAt: string;
  endAt: string;
  location?: string | null;
}): string {
  const start = formatGoogleDates(new Date(input.startAt));
  const end = formatGoogleDates(new Date(input.endAt));
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', input.title);
  url.searchParams.set('details', input.details);
  url.searchParams.set('dates', `${start}/${end}`);
  if (input.location) {
    url.searchParams.set('location', input.location);
  }
  return url.toString();
}

function formatIcsUtc(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function formatGoogleDates(date: Date) {
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

function foldDescription(value: string) {
  return value.slice(0, 3500);
}

function hashSeed(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function formatInTimezone(
  iso: string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone,
    ...options,
  });
}

/**
 * Spells out date/time in the recipient timezone, including the timezone name.
 * Example: "Friday, 10 July 2026 at 15:00 British Summer Time (Europe/London)"
 */
export function formatBookingWhenForEmail(iso: string, timeZone: string) {
  const date = new Date(iso);
  const base = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  const zoneName =
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      timeZoneName: 'long',
    })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? timeZone;

  return `${base} ${zoneName} (${timeZone})`;
}
