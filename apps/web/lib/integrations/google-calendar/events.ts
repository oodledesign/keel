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
  ScheduledPlannerBlock,
} from './types';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const PLANNER_CALENDAR_NAME = 'Keel Planner';

type GoogleEvent = {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { displayName?: string; email?: string };
};

type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
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
      description: 'Tasks scheduled by Keel Planner',
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
          description: 'Scheduled by Keel Planner',
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
