import 'server-only';

import { parseYmd, zonedDateTimeToUtc } from '../timezone';
import type { BusyInterval } from '../types';
import { getGoogleClientsForWorkspace } from './client';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

type FreeBusyResponse = {
  calendars?: Record<
    string,
    {
      busy?: Array<{ start?: string; end?: string }>;
      errors?: Array<{ domain?: string; reason?: string }>;
    }
  >;
};

type CalendarListEntry = {
  id: string;
  selected?: boolean;
  primary?: boolean;
};

type CalendarEventItem = {
  status?: string;
  transparency?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
};

type EventsListResponse = {
  items?: CalendarEventItem[];
  nextPageToken?: string;
};

async function listCalendarIds(
  accessToken: string,
  preferred: string[],
  fallbackCalendarId: string,
): Promise<string[]> {
  if (preferred.length > 0) {
    return preferred;
  }

  const res = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    return [fallbackCalendarId];
  }

  const body = (await res.json()) as { items?: CalendarListEntry[] };
  const ids = (body.items ?? [])
    .filter((calendar) => calendar.id)
    .filter((calendar) => calendar.selected !== false || calendar.primary)
    .map((calendar) => calendar.id);

  if (ids.length === 0) {
    return [fallbackCalendarId];
  }

  if (!ids.includes(fallbackCalendarId) && fallbackCalendarId) {
    return [...ids, fallbackCalendarId];
  }

  return ids;
}

function pushInterval(
  intervals: BusyInterval[],
  startRaw: string,
  endRaw: string,
) {
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (
    Number.isFinite(start.getTime()) &&
    Number.isFinite(end.getTime()) &&
    end.getTime() > start.getTime()
  ) {
    intervals.push({ start, end });
  }
}

/**
 * Google all-day events use exclusive end dates (`YYYY-MM-DD`).
 * Interpret start/end midnights in the host schedule timezone so a full local
 * day is blocked (freeBusy alone can miss these depending on calendar settings).
 */
function pushAllDayInterval(
  intervals: BusyInterval[],
  startDate: string,
  endDate: string,
  timeZone: string,
) {
  try {
    const startParts = parseYmd(startDate);
    const endParts = parseYmd(endDate);
    const start = zonedDateTimeToUtc(
      startParts.year,
      startParts.monthIndex,
      startParts.day,
      0,
      0,
      0,
      timeZone,
    );
    const end = zonedDateTimeToUtc(
      endParts.year,
      endParts.monthIndex,
      endParts.day,
      0,
      0,
      0,
      timeZone,
    );
    if (end.getTime() > start.getTime()) {
      intervals.push({ start, end });
    }
  } catch {
    // Fall back to UTC midnights if the date string is malformed.
    pushInterval(
      intervals,
      `${startDate}T00:00:00.000Z`,
      `${endDate}T00:00:00.000Z`,
    );
  }
}

async function freeBusyForClient(input: {
  accessToken: string;
  calendarIds: string[];
  from: Date;
  to: Date;
  timeZone: string;
}): Promise<BusyInterval[]> {
  const res = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: input.from.toISOString(),
      timeMax: input.to.toISOString(),
      timeZone: input.timeZone,
      items: input.calendarIds.map((id) => ({ id })),
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    throw new Error(
      `Google free/busy failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  const body = (await res.json()) as FreeBusyResponse;
  const intervals: BusyInterval[] = [];

  for (const calendar of Object.values(body.calendars ?? {})) {
    for (const block of calendar.busy ?? []) {
      if (!block.start || !block.end) continue;
      pushInterval(intervals, block.start, block.end);
    }
  }

  return intervals;
}

/**
 * freeBusy can miss some all-day / focus / OOO style blocks depending on
 * calendar settings. Pull events and treat opaque ones as busy.
 */
async function eventBusyForCalendar(input: {
  accessToken: string;
  calendarId: string;
  from: Date;
  to: Date;
  timeZone: string;
}): Promise<BusyInterval[]> {
  const intervals: BusyInterval[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin: input.from.toISOString(),
      timeMax: input.to.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events?${params}`,
      {
        headers: { authorization: `Bearer ${input.accessToken}` },
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!res.ok) {
      throw new Error(
        `Google events list failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
      );
    }

    const body = (await res.json()) as EventsListResponse;
    for (const event of body.items ?? []) {
      if (event.status === 'cancelled') continue;
      // Respect "Show as: Free"
      if (event.transparency === 'transparent') continue;

      const startDate = event.start?.date?.trim();
      const endDate = event.end?.date?.trim();
      if (startDate && endDate) {
        pushAllDayInterval(intervals, startDate, endDate, input.timeZone);
        continue;
      }

      const startDateTime = event.start?.dateTime?.trim();
      const endDateTime = event.end?.dateTime?.trim();
      if (startDateTime && endDateTime) {
        pushInterval(intervals, startDateTime, endDateTime);
      }
    }

    pageToken = body.nextPageToken;
  } while (pageToken);

  return intervals;
}

async function busyForClient(input: {
  accessToken: string;
  calendarIds: string[];
  from: Date;
  to: Date;
  timeZone: string;
}): Promise<BusyInterval[]> {
  const freeBusy = await freeBusyForClient(input);

  const eventBatches = await Promise.all(
    input.calendarIds.map(async (calendarId) => {
      try {
        return await eventBusyForCalendar({
          accessToken: input.accessToken,
          calendarId,
          from: input.from,
          to: input.to,
          timeZone: input.timeZone,
        });
      } catch (error) {
        console.warn('[scheduling/google] events busy fallback failed', {
          calendarId,
          message: error instanceof Error ? error.message : String(error),
        });
        return [] as BusyInterval[];
      }
    }),
  );

  return [...freeBusy, ...eventBatches.flat()];
}

/**
 * Google Calendar free/busy across every Google account the host has connected
 * (work + personal, etc.).
 */
export async function getBusyIntervals(
  workspaceId: string,
  from: Date,
  to: Date,
  options?: { hostUserId?: string; timeZone?: string },
): Promise<BusyInterval[]> {
  if (!(to.getTime() > from.getTime())) {
    return [];
  }

  const timeZone = options?.timeZone?.trim() || 'UTC';
  const clients = await getGoogleClientsForWorkspace(workspaceId, options);

  const batches = await Promise.all(
    clients.map(async (client) => {
      try {
        const calendarIds = await listCalendarIds(
          client.accessToken,
          client.busyCalendarIds,
          client.calendarId,
        );
        return await busyForClient({
          accessToken: client.accessToken,
          calendarIds,
          from,
          to,
          timeZone,
        });
      } catch (error) {
        console.warn('[scheduling/google] busy intervals failed for account', {
          email: client.accountEmail,
          message: error instanceof Error ? error.message : String(error),
        });
        // One broken secondary account shouldn't wipe availability entirely.
        return [];
      }
    }),
  );

  return batches.flat().sort((a, b) => a.start.getTime() - b.start.getTime());
}
