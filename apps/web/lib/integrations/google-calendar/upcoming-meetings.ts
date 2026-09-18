export type CalendarAttendeeLike = {
  displayName?: string | null;
  name?: string | null;
  email?: string | null;
  self?: boolean;
  resource?: boolean;
  responseStatus?: string | null;
};

export type UpcomingMeetingSource = 'calendar' | 'booking';

export type UpcomingMeetingItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  inviteeName: string;
  conferencingUrl: string | null;
  detailHref: string | null;
  source: UpcomingMeetingSource;
};

export function normalizeCalendarEmail(
  value: string | null | undefined,
): string {
  return value?.trim().toLowerCase() ?? '';
}

function isUserAttendee(
  attendee: CalendarAttendeeLike,
  userEmails: Set<string>,
): boolean {
  if (attendee.self) return true;
  const email = normalizeCalendarEmail(attendee.email);
  return Boolean(email && userEmails.has(email));
}

function humanAttendees(
  attendees: CalendarAttendeeLike[] | undefined,
): CalendarAttendeeLike[] {
  return (attendees ?? []).filter((attendee) => !attendee.resource);
}

/**
 * True when the event is a real meeting with someone else.
 * Solo / focus blocks (no guests, or only the current user) stay out.
 */
export function calendarEventHasOtherParticipants(
  attendees: CalendarAttendeeLike[] | undefined,
  userEmails: Iterable<string> = [],
): boolean {
  const people = humanAttendees(attendees);
  if (people.length === 0) return false;

  const userSet = new Set(
    [...userEmails].map(normalizeCalendarEmail).filter(Boolean),
  );
  const selfAttendee = people.find((attendee) =>
    isUserAttendee(attendee, userSet),
  );
  if (selfAttendee?.responseStatus?.toLowerCase() === 'declined') {
    return false;
  }

  if (people.length > 1) return true;

  const only = people[0]!;
  if (isUserAttendee(only, userSet)) return false;
  if (only.self === false) return true;
  const email = normalizeCalendarEmail(only.email);
  return Boolean(email && userSet.size > 0 && !userSet.has(email));
}

export function otherParticipantLabel(
  attendees: CalendarAttendeeLike[] | undefined,
  userEmails: Iterable<string> = [],
): string {
  const userSet = new Set(
    [...userEmails].map(normalizeCalendarEmail).filter(Boolean),
  );
  const names = humanAttendees(attendees)
    .filter((attendee) => !isUserAttendee(attendee, userSet))
    .map(
      (attendee) =>
        attendee.displayName?.trim() ||
        attendee.name?.trim() ||
        attendee.email?.trim() ||
        'Guest',
    );

  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} others`;
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase();
}

export function upcomingMeetingsMatch(
  left: Pick<UpcomingMeetingItem, 'title' | 'startAt' | 'conferencingUrl'>,
  right: Pick<UpcomingMeetingItem, 'title' | 'startAt' | 'conferencingUrl'>,
): boolean {
  const leftUrl = left.conferencingUrl
    ? normalizeUrl(left.conferencingUrl)
    : '';
  const rightUrl = right.conferencingUrl
    ? normalizeUrl(right.conferencingUrl)
    : '';
  if (leftUrl && rightUrl && leftUrl === rightUrl) return true;

  const leftStart = Date.parse(left.startAt);
  const rightStart = Date.parse(right.startAt);
  if (Number.isNaN(leftStart) || Number.isNaN(rightStart)) return false;
  if (Math.abs(leftStart - rightStart) > 2 * 60 * 1000) return false;
  return normalizeTitle(left.title) === normalizeTitle(right.title);
}

export function isUpcomingMeetingActive(
  meeting: Pick<UpcomingMeetingItem, 'startAt' | 'endAt'>,
  nowMs = Date.now(),
): boolean {
  const start = Date.parse(meeting.startAt);
  const end = meeting.endAt ? Date.parse(meeting.endAt) : Number.NaN;
  if (Number.isNaN(start)) return false;
  if (start >= nowMs) return true;
  return !Number.isNaN(end) && end > nowMs;
}

/** Calendar meetings first; unmatched Ozer bookings keep Join / detail links. */
export function mergeUpcomingMeetings(
  calendarMeetings: UpcomingMeetingItem[],
  bookingMeetings: UpcomingMeetingItem[],
  limit = 8,
  nowMs = Date.now(),
): UpcomingMeetingItem[] {
  const merged: UpcomingMeetingItem[] = [];

  for (const meeting of calendarMeetings) {
    const booking = bookingMeetings.find((row) =>
      upcomingMeetingsMatch(meeting, row),
    );
    if (booking) {
      merged.push({
        ...meeting,
        conferencingUrl: meeting.conferencingUrl || booking.conferencingUrl,
        detailHref: booking.detailHref || meeting.detailHref,
        inviteeName: meeting.inviteeName || booking.inviteeName,
      });
      continue;
    }
    merged.push(meeting);
  }

  for (const booking of bookingMeetings) {
    if (merged.some((row) => upcomingMeetingsMatch(row, booking))) continue;
    merged.push(booking);
  }

  return merged
    .filter((row) => isUpcomingMeetingActive(row, nowMs))
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
    .slice(0, limit);
}
