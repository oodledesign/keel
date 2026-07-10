import type { SupabaseClient } from '@supabase/supabase-js';

import {
  loadGoogleCalendarConnection,
  updateGoogleCalendarAccessToken,
  updatePlannerCalendarId,
} from './connection';
import { isPlannerMockCalendarEnabled } from './env';
import { refreshGoogleCalendarToken } from './oauth';
import type {
  GoogleCalendarConnection,
  PlannerCalendarEvent,
  PlannerCalendarSyncBlock,
  PlannerCalendarSyncMapping,
  RecorderCalendarEvent,
  ScheduledPlannerBlock,
} from './types';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const PLANNER_CALENDAR_NAME = 'Ozer Planner';

type GoogleEvent = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
    }>;
  };
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { displayName?: string; email?: string };
  attendees?: Array<{ displayName?: string; email?: string }>;
  /** Google status events (working location, OOO, etc.) — not real time blocks. */
  eventType?: string;
};

/** Status/metadata events Google returns but users don't treat as calendar blocks. */
function isPlannerCalendarBlock(event: GoogleEvent): boolean {
  switch (event.eventType) {
    case 'workingLocation':
    case 'birthday':
    case 'fromGmail':
      return false;
    default:
      return true;
  }
}

type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
  selected?: boolean;
  primary?: boolean;
};

const RECORDER_CALENDAR_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const RECORDER_CALENDAR_LOOKAHEAD_MS = 2 * 60 * 60 * 1000;
const RECORDER_CALENDAR_NEXT_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;
const MAX_RECORDER_CALENDARS = 20;

export type RecorderCalendarEventResult = {
  connected: boolean;
  event: RecorderCalendarEvent | null;
  next_event: RecorderCalendarEvent | null;
  upcoming_events: RecorderCalendarEvent[];
};

function isExpiringSoon(iso: string | null) {
  if (!iso) return true;
  return new Date(iso).getTime() < Date.now() + 60_000;
}

async function validConnection(
  client: SupabaseClient,
  userId: string,
): Promise<GoogleCalendarConnection | null> {
  const connection = await loadGoogleCalendarConnection(client, userId);
  if (!connection) return null;

  if (!isExpiringSoon(connection.tokenExpiresAt)) {
    return connection;
  }

  if (!connection.refreshToken) {
    return connection;
  }

  const tokens = await refreshGoogleCalendarToken(connection.refreshToken);
  await updateGoogleCalendarAccessToken(client, {
    userId,
    tokens,
    refreshToken: connection.refreshToken,
  });

  return loadGoogleCalendarConnection(client, userId);
}

async function googleJson<T>(
  connection: GoogleCalendarConnection,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(15_000),
    headers: {
      authorization: `Bearer ${connection.accessToken}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(
      `Google Calendar API error (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  return (await res.json()) as T;
}

function mapGoogleEvent(
  event: GoogleEvent,
  calendarId: string,
): PlannerCalendarEvent | null {
  if (!isPlannerCalendarBlock(event)) return null;

  const start = event.start?.dateTime ?? event.start?.date;
  const end = event.end?.dateTime ?? event.end?.date;
  if (!start || !end) return null;

  return {
    id: event.id ?? `${start}-${event.summary ?? 'event'}`,
    title: event.summary?.trim() || 'Busy',
    start,
    end,
    calendar: event.organizer?.displayName ?? event.organizer?.email ?? 'Google',
    calendar_id: calendarId,
    is_all_day: Boolean(event.start?.date),
  };
}

function mapRecorderCalendarEvent(
  event: GoogleEvent,
  calendarId: string,
): RecorderCalendarEvent | null {
  const base = mapGoogleEvent(event, calendarId);
  if (!base) return null;

  return {
    id: event.id?.trim() || `${base.title}-${base.start}`,
    title: base.title,
    start: base.start,
    end: base.end,
    attendees: (event.attendees ?? []).map((attendee) => ({
      name: attendee.displayName?.trim() || attendee.email?.trim() || 'Guest',
      email: attendee.email?.trim() || '',
    })),
    meeting_url: extractMeetingUrl(event),
  };
}

const MEETING_HOST_HINTS = [
  'meet.google.com',
  'zoom.us',
  'zoom.com',
  'teams.microsoft.com',
  'teams.live.com',
  'webex.com',
  'whereby.com',
  'meet.jit.si',
  'facetime.apple.com',
];

const URL_IN_TEXT =
  /https?:\/\/[^\s<>"')\]]+/gi;

function extractMeetingUrl(event: GoogleEvent): string | null {
  const hangout = event.hangoutLink?.trim();
  if (hangout && isHttpUrl(hangout)) {
    return hangout;
  }

  const videoEntry = event.conferenceData?.entryPoints?.find(
    (entry) =>
      entry.entryPointType === 'video' &&
      typeof entry.uri === 'string' &&
      isHttpUrl(entry.uri),
  );
  if (videoEntry?.uri) {
    return videoEntry.uri.trim();
  }

  const fromLocation = firstMeetingUrlInText(event.location);
  if (fromLocation) return fromLocation;

  return firstMeetingUrlInText(event.description);
}

function firstMeetingUrlInText(text: string | undefined): string | null {
  if (!text) return null;
  const matches = text.match(URL_IN_TEXT) ?? [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[.,;:!?)]+$/, '');
    if (!isHttpUrl(cleaned)) continue;
    try {
      const host = new URL(cleaned).hostname.toLowerCase();
      if (MEETING_HOST_HINTS.some((hint) => host === hint || host.endsWith(`.${hint}`))) {
        return cleaned;
      }
    } catch {
      continue;
    }
  }
  // Fall back to first http(s) URL in location/description if nothing matched hosts.
  for (const raw of matches) {
    const cleaned = raw.replace(/[.,;:!?)]+$/, '');
    if (isHttpUrl(cleaned)) return cleaned;
  }
  return null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function pickNextUpcomingRecorderEvent(
  events: RecorderCalendarEvent[],
  nowMs = Date.now(),
): RecorderCalendarEvent | null {
  return (
    events.find((event) => {
      const start = Date.parse(event.start);
      if (Number.isNaN(start)) return false;
      return start > nowMs;
    }) ?? null
  );
}

function pickUpcomingRecorderEvents(
  events: RecorderCalendarEvent[],
  nowMs = Date.now(),
  limit = 20,
): RecorderCalendarEvent[] {
  return events
    .filter((event) => {
      const start = Date.parse(event.start);
      return !Number.isNaN(start) && start > nowMs;
    })
    .slice(0, limit);
}

function pickCurrentOrNextRecorderEvent(
  events: RecorderCalendarEvent[],
  nowMs = Date.now(),
): RecorderCalendarEvent | null {
  const horizonMs = nowMs + 2 * 60 * 60 * 1000;

  const current = events.find((event) => {
    const start = Date.parse(event.start);
    const end = Date.parse(event.end);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return start <= nowMs && end > nowMs;
  });
  if (current) return current;

  return (
    events.find((event) => {
      const start = Date.parse(event.start);
      if (Number.isNaN(start)) return false;
      return start > nowMs && start <= horizonMs;
    }) ?? null
  );
}

async function listGoogleCalendarEventsInRange(
  connection: GoogleCalendarConnection,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEvent[]> {
  const calendars = await googleJson<{ items?: GoogleCalendarListEntry[] }>(
    connection,
    '/users/me/calendarList',
  );

  const calendarIds = (calendars.items ?? [])
    .filter((calendar) => calendar.id)
    .filter((calendar) => calendar.selected !== false || calendar.primary)
    .map((calendar) => calendar.id)
    .slice(0, MAX_RECORDER_CALENDARS);

  const targetIds =
    calendarIds.length > 0 ? calendarIds : [connection.calendarId];

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    conferenceDataVersion: '1',
  });

  const batches = await Promise.all(
    targetIds.map(async (calendarId) => {
      try {
        const body = await googleJson<{ items?: GoogleEvent[] }>(
          connection,
          `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        );
        return (body.items ?? []).map((item) => ({ item, calendarId }));
      } catch {
        return [];
      }
    }),
  );

  return batches.flat();
}

function mockRecorderEvents(nowMs: number): RecorderCalendarEvent[] {
  const currentStart = new Date(nowMs - 15 * 60 * 1000);
  const currentEnd = new Date(nowMs + 45 * 60 * 1000);

  const scheduled = mockEvents(new Date(nowMs).toISOString()).map((event) => ({
    id: `mock-${event.id}`,
    title: event.title,
    start: event.start,
    end: event.end,
    attendees: [
      { name: 'Alex Example', email: 'alex@example.com' },
      { name: 'Sam Example', email: 'sam@example.com' },
    ],
    meeting_url: 'https://meet.google.com/abc-defg-hij',
  }));

  return [
    {
      id: 'mock-current-meeting',
      title: 'Current meeting (mock)',
      start: currentStart.toISOString(),
      end: currentEnd.toISOString(),
      attendees: [
        { name: 'Alex Example', email: 'alex@example.com' },
        { name: 'Sam Example', email: 'sam@example.com' },
      ],
      meeting_url: 'https://zoom.us/j/123456789',
    },
    ...scheduled,
  ];
}

export async function getRecorderCalendarEvent(
  client: SupabaseClient,
  input: { userId: string },
): Promise<RecorderCalendarEventResult> {
  const nowMs = Date.now();
  const timeMin = new Date(nowMs - RECORDER_CALENDAR_LOOKBACK_MS).toISOString();
  const timeMax = new Date(nowMs + RECORDER_CALENDAR_NEXT_LOOKAHEAD_MS).toISOString();

  if (isPlannerMockCalendarEnabled()) {
    const events = mockRecorderEvents(nowMs);
    return {
      connected: true,
      event: pickCurrentOrNextRecorderEvent(events, nowMs),
      next_event: pickNextUpcomingRecorderEvent(events, nowMs),
      upcoming_events: pickUpcomingRecorderEvents(events, nowMs),
    };
  }

  const connection = await validConnection(client, input.userId);
  if (!connection) {
    return { connected: false, event: null, next_event: null, upcoming_events: [] };
  }

  const items = await listGoogleCalendarEventsInRange(
    connection,
    timeMin,
    timeMax,
  );

  const events = items
    .map(({ item, calendarId }) => mapRecorderCalendarEvent(item, calendarId))
    .filter((event): event is RecorderCalendarEvent => Boolean(event))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  return {
    connected: true,
    event: pickCurrentOrNextRecorderEvent(events, nowMs),
    next_event: pickNextUpcomingRecorderEvent(events, nowMs),
    upcoming_events: pickUpcomingRecorderEvents(events, nowMs),
  };
}

const RECORDING_MATCH_LOOKBACK_MS = 6 * 60 * 60 * 1000;
const RECORDING_MATCH_LOOKAHEAD_MS = 60 * 60 * 1000;

/** Match a Google Calendar event to a desktop-recorder sync timestamp. */
export async function findRecorderCalendarEventAt(
  client: SupabaseClient,
  input: { userId: string; instant: Date },
): Promise<RecorderCalendarEvent | null> {
  const instantMs = input.instant.getTime();
  const timeMin = new Date(instantMs - RECORDING_MATCH_LOOKBACK_MS).toISOString();
  const timeMax = new Date(instantMs + RECORDING_MATCH_LOOKAHEAD_MS).toISOString();

  if (isPlannerMockCalendarEnabled()) {
    const events = mockRecorderEvents(instantMs);
    return pickBestRecorderEventForInstant(events, instantMs);
  }

  const connection = await validConnection(client, input.userId);
  if (!connection) {
    return null;
  }

  const items = await listGoogleCalendarEventsInRange(connection, timeMin, timeMax);
  const events = items
    .map(({ item, calendarId }) => mapRecorderCalendarEvent(item, calendarId))
    .filter((event): event is RecorderCalendarEvent => Boolean(event));

  return pickBestRecorderEventForInstant(events, instantMs);
}

function pickBestRecorderEventForInstant(
  events: RecorderCalendarEvent[],
  instantMs: number,
): RecorderCalendarEvent | null {
  if (events.length === 0) {
    return null;
  }

  const inProgress = events.find((event) => {
    const start = Date.parse(event.start);
    const end = Date.parse(event.end);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return false;
    }
    return start <= instantMs && end >= instantMs;
  });

  if (inProgress) {
    return inProgress;
  }

  let best: RecorderCalendarEvent | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const event of events) {
    const start = Date.parse(event.start);
    const end = Date.parse(event.end);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      continue;
    }

    const distance =
      instantMs < start
        ? start - instantMs
        : instantMs > end
          ? instantMs - end
          : 0;

    if (distance < bestDistance) {
      bestDistance = distance;
      best = event;
    }
  }

  return bestDistance <= 2 * 60 * 60 * 1000 ? best : null;
}

function mockEvents(timeMin: string): PlannerCalendarEvent[] {
  const base = new Date(timeMin);
  const first = new Date(base);
  first.setHours(10, 0, 0, 0);
  const firstEnd = new Date(first);
  firstEnd.setMinutes(firstEnd.getMinutes() + 30);

  const second = new Date(base);
  second.setHours(14, 30, 0, 0);
  const secondEnd = new Date(second);
  secondEnd.setMinutes(secondEnd.getMinutes() + 45);

  return [
    {
      id: 'mock-standup',
      title: 'Team stand-up',
      start: first.toISOString(),
      end: firstEnd.toISOString(),
      calendar: 'Google Calendar',
      calendar_id: 'mock-calendar',
      is_all_day: false,
    },
    {
      id: 'mock-review',
      title: 'Client review',
      start: second.toISOString(),
      end: secondEnd.toISOString(),
      calendar: 'Google Calendar',
      calendar_id: 'mock-calendar',
      is_all_day: false,
    },
  ];
}

export async function listPlannerCalendarEvents(
  client: SupabaseClient,
  input: {
    userId: string;
    timeMin: string;
    timeMax: string;
  },
) {
  if (isPlannerMockCalendarEnabled()) {
    return { connected: false, configured: true, events: mockEvents(input.timeMin) };
  }

  const connection = await validConnection(client, input.userId);
  if (!connection) {
    return { connected: false, configured: true, events: [] };
  }

  const params = new URLSearchParams({
    timeMin: input.timeMin,
    timeMax: input.timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const body = await googleJson<{ items?: GoogleEvent[] }>(
    connection,
    `/calendars/${encodeURIComponent(connection.calendarId)}/events?${params}`,
  );

  return {
    connected: true,
    configured: true,
    events: (body.items ?? [])
      .map((item) => mapGoogleEvent(item, connection.calendarId))
      .filter((event): event is PlannerCalendarEvent => Boolean(event)),
  };
}

async function resolvePlannerCalendarId(
  connection: GoogleCalendarConnection,
): Promise<string> {
  if (connection.plannerCalendarId) {
    return connection.plannerCalendarId;
  }

  const calendars = await googleJson<{ items?: GoogleCalendarListEntry[] }>(
    connection,
    '/users/me/calendarList',
  );

  const existing = (calendars.items ?? []).find(
    (calendar) => calendar.summary === PLANNER_CALENDAR_NAME,
  );

  if (existing?.id) {
    return existing.id;
  }

  const hasFullCalendarScope = (connection.scopes ?? '')
    .split(/\s+/)
    .includes('https://www.googleapis.com/auth/calendar');

  if (hasFullCalendarScope) {
    try {
      const created = await googleJson<{ id: string }>(connection, '/calendars', {
        method: 'POST',
        body: JSON.stringify({
          summary: PLANNER_CALENDAR_NAME,
          description: 'Tasks scheduled by Ozer Planner',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }),
      });

      if (created.id) {
        return created.id;
      }
    } catch {
      // Workspace policy or missing permission — use primary calendar below.
    }
  }

  const primary = (calendars.items ?? []).find((calendar) => calendar.primary)?.id;
  return primary ?? connection.calendarId ?? 'primary';
}

async function ensurePlannerCalendar(
  client: SupabaseClient,
  userId: string,
  connection: GoogleCalendarConnection,
) {
  const calendarId = await resolvePlannerCalendarId(connection);

  if (calendarId !== connection.plannerCalendarId) {
    await updatePlannerCalendarId(client, userId, calendarId);
  }

  return calendarId;
}

export async function createPlannerCalendarEvents(
  client: SupabaseClient,
  input: {
    userId: string;
    blocks: ScheduledPlannerBlock[];
  },
) {
  const connection = await validConnection(client, input.userId);
  if (!connection) {
    throw new Error('Connect Google Calendar before pushing planner events');
  }

  const calendarId = await ensurePlannerCalendar(client, input.userId, connection);
  const errors: string[] = [];
  let created = 0;

  for (const block of input.blocks) {
    try {
      await googleJson(connection, `/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        body: JSON.stringify({
          summary: block.title,
          description: 'Scheduled by Ozer Planner',
          start: { dateTime: block.start },
          end: { dateTime: block.end },
        }),
      });
      created += 1;
    } catch (err) {
      errors.push(
        `${block.title}: ${err instanceof Error ? err.message : 'Could not create event'}`,
      );
    }
  }

  return { created, errors };
}

export async function getValidGoogleCalendarConnection(
  client: SupabaseClient,
  userId: string,
): Promise<GoogleCalendarConnection | null> {
  return validConnection(client, userId);
}

export async function listUserGoogleCalendars(
  client: SupabaseClient,
  userId: string,
) {
  const connection = await validConnection(client, userId);
  if (!connection) {
    return { connected: false as const, calendars: [] };
  }

  const body = await googleJson<{ items?: GoogleCalendarListEntry[] }>(
    connection,
    '/users/me/calendarList',
  );

  const calendars = (body.items ?? [])
    .filter((calendar) => calendar.id)
    .map((calendar) => ({
      id: calendar.id,
      summary: calendar.summary?.trim() || calendar.id,
      primary: Boolean(calendar.primary),
      selected: calendar.selected !== false || Boolean(calendar.primary),
    }));

  return {
    connected: true as const,
    calendars,
    busyCalendarIds: connection.busyCalendarIds,
    personalCalendarIds: connection.personalCalendarIds,
  };
}

function resolveBusyCalendarIds(
  connection: GoogleCalendarConnection,
  availableCalendars: GoogleCalendarListEntry[],
): string[] {
  if (connection.busyCalendarIds.length > 0) {
    return connection.busyCalendarIds;
  }

  return availableCalendars
    .filter((calendar) => calendar.id)
    .filter((calendar) => calendar.selected !== false || calendar.primary)
    .map((calendar) => calendar.id);
}

export async function listBusyIntervalsForScheduling(
  client: SupabaseClient,
  input: {
    userId: string;
    timeMin: string;
    timeMax: string;
    excludePersonalCalendarBusy: boolean;
  },
): Promise<Array<{ start: string; end: string }>> {
  const connection = await validConnection(client, input.userId);
  if (!connection) {
    return [];
  }

  const calendarList = await googleJson<{ items?: GoogleCalendarListEntry[] }>(
    connection,
    '/users/me/calendarList',
  );

  const available = calendarList.items ?? [];
  let calendarIds = resolveBusyCalendarIds(connection, available);

  if (input.excludePersonalCalendarBusy && connection.personalCalendarIds.length > 0) {
    const personal = new Set(connection.personalCalendarIds);
    calendarIds = calendarIds.filter((id) => !personal.has(id));
  }

  if (calendarIds.length === 0) {
    calendarIds = [connection.calendarId];
  }

  const params = new URLSearchParams({
    timeMin: input.timeMin,
    timeMax: input.timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const batches = await Promise.all(
    calendarIds.slice(0, MAX_RECORDER_CALENDARS).map(async (calendarId) => {
      try {
        const body = await googleJson<{ items?: GoogleEvent[] }>(
          connection,
          `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        );

        return (body.items ?? [])
          .map((item) => mapGoogleEvent(item, calendarId))
          .filter((event): event is PlannerCalendarEvent => Boolean(event))
          .map((event) => ({ start: event.start, end: event.end }));
      } catch {
        return [];
      }
    }),
  );

  return batches.flat();
}

export async function createTaskCalendarEvent(
  client: SupabaseClient,
  input: {
    userId: string;
    title: string;
    start: string;
    end: string;
    description?: string | null;
  },
): Promise<string> {
  const connection = await validConnection(client, input.userId);
  if (!connection) {
    throw new Error('Assignee has not connected Google Calendar');
  }

  const calendarId = await ensurePlannerCalendar(client, input.userId, connection);

  const created = await googleJson<{ id?: string }>(
    connection,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      body: JSON.stringify({
        summary: input.title,
        description: input.description?.trim() || 'Scheduled by Ozer',
        start: { dateTime: input.start },
        end: { dateTime: input.end },
      }),
    },
  );

  if (!created.id) {
    throw new Error('Google Calendar did not return an event id');
  }

  return created.id;
}

async function patchGoogleCalendarEvent(
  connection: GoogleCalendarConnection,
  input: {
    calendarId: string;
    eventId: string;
    summary: string;
    start: string;
    end: string;
  },
) {
  await googleJson(
    connection,
    `/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        summary: input.summary,
        start: { dateTime: input.start },
        end: { dateTime: input.end },
      }),
    },
  );
}

export async function syncPlannerCalendarEvents(
  client: SupabaseClient,
  input: {
    userId: string;
    blocks: PlannerCalendarSyncBlock[];
  },
) {
  const connection = await validConnection(client, input.userId);
  if (!connection) {
    throw new Error('Connect Google Calendar before syncing planner events');
  }

  const plannerCalendarId = await ensurePlannerCalendar(
    client,
    input.userId,
    connection,
  );
  const readCalendarId = connection.calendarId;
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  const mappings: PlannerCalendarSyncMapping[] = [];

  for (const block of input.blocks) {
    if (block.isBreak) {
      continue;
    }

    if (block.googleEventId) {
      const calendarId = block.isCalendarEvent
        ? block.googleCalendarId || readCalendarId
        : block.googleCalendarId || plannerCalendarId;

      try {
        await patchGoogleCalendarEvent(connection, {
          calendarId,
          eventId: block.googleEventId,
          summary: block.title,
          start: block.start,
          end: block.end,
        });
        updated += 1;
        mappings.push({
          blockId: block.blockId,
          googleEventId: block.googleEventId,
          googleCalendarId: calendarId,
          pushedByPlanner: block.pushedByPlanner || !block.isCalendarEvent,
        });
      } catch (err) {
        errors.push(
          `${block.title}: ${err instanceof Error ? err.message : 'Could not update event'}`,
        );
      }
      continue;
    }

    if (block.isCalendarEvent) {
      continue;
    }

    try {
      const createdEvent = await googleJson<{ id?: string }>(
        connection,
        `/calendars/${encodeURIComponent(plannerCalendarId)}/events`,
        {
          method: 'POST',
          body: JSON.stringify({
            summary: block.title,
            description: 'Scheduled by Ozer Planner',
            start: { dateTime: block.start },
            end: { dateTime: block.end },
          }),
        },
      );

      if (createdEvent.id) {
        created += 1;
        mappings.push({
          blockId: block.blockId,
          googleEventId: createdEvent.id,
          googleCalendarId: plannerCalendarId,
          pushedByPlanner: true,
        });
      }
    } catch (err) {
      errors.push(
        `${block.title}: ${err instanceof Error ? err.message : 'Could not create event'}`,
      );
    }
  }

  return { created, updated, errors, mappings };
}
