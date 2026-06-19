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
  RecorderCalendarEvent,
  ScheduledPlannerBlock,
} from './types';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const PLANNER_CALENDAR_NAME = 'Ozer Planner';

type GoogleEvent = {
  id?: string;
  summary?: string;
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

function mapGoogleEvent(event: GoogleEvent): PlannerCalendarEvent | null {
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
    is_all_day: Boolean(event.start?.date),
  };
}

function mapRecorderCalendarEvent(event: GoogleEvent): RecorderCalendarEvent | null {
  const base = mapGoogleEvent(event);
  if (!base) return null;

  return {
    title: base.title,
    start: base.start,
    end: base.end,
    attendees: (event.attendees ?? []).map((attendee) => ({
      name: attendee.displayName?.trim() || attendee.email?.trim() || 'Guest',
      email: attendee.email?.trim() || '',
    })),
  };
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
  });

  const batches = await Promise.all(
    targetIds.map(async (calendarId) => {
      try {
        const body = await googleJson<{ items?: GoogleEvent[] }>(
          connection,
          `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        );
        return body.items ?? [];
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
    title: event.title,
    start: event.start,
    end: event.end,
    attendees: [
      { name: 'Alex Example', email: 'alex@example.com' },
      { name: 'Sam Example', email: 'sam@example.com' },
    ],
  }));

  return [
    {
      title: 'Current meeting (mock)',
      start: currentStart.toISOString(),
      end: currentEnd.toISOString(),
      attendees: [
        { name: 'Alex Example', email: 'alex@example.com' },
        { name: 'Sam Example', email: 'sam@example.com' },
      ],
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
    .map(mapRecorderCalendarEvent)
    .filter((event): event is RecorderCalendarEvent => Boolean(event))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  return {
    connected: true,
    event: pickCurrentOrNextRecorderEvent(events, nowMs),
    next_event: pickNextUpcomingRecorderEvent(events, nowMs),
    upcoming_events: pickUpcomingRecorderEvents(events, nowMs),
  };
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
      is_all_day: false,
    },
    {
      id: 'mock-review',
      title: 'Client review',
      start: second.toISOString(),
      end: secondEnd.toISOString(),
      calendar: 'Google Calendar',
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
      .map(mapGoogleEvent)
      .filter((event): event is PlannerCalendarEvent => Boolean(event)),
  };
}

async function ensurePlannerCalendar(
  client: SupabaseClient,
  userId: string,
  connection: GoogleCalendarConnection,
) {
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
    await updatePlannerCalendarId(client, userId, existing.id);
    return existing.id;
  }

  const created = await googleJson<{ id: string }>(connection, '/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: PLANNER_CALENDAR_NAME,
      description: 'Tasks scheduled by Ozer Planner',
      timeZone: 'Europe/London',
    }),
  });

  await updatePlannerCalendarId(client, userId, created.id);
  return created.id;
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
