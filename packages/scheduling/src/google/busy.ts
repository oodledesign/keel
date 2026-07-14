import 'server-only';

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

  return ids.length > 0 ? ids : [fallbackCalendarId];
}

async function freeBusyForClient(input: {
  accessToken: string;
  calendarIds: string[];
  from: Date;
  to: Date;
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
      const start = new Date(block.start);
      const end = new Date(block.end);
      if (end.getTime() > start.getTime()) {
        intervals.push({ start, end });
      }
    }
  }

  return intervals;
}

/**
 * Google Calendar free/busy across every Google account the host has connected
 * (work + personal, etc.).
 */
export async function getBusyIntervals(
  workspaceId: string,
  from: Date,
  to: Date,
  options?: { hostUserId?: string },
): Promise<BusyInterval[]> {
  if (!(to.getTime() > from.getTime())) {
    return [];
  }

  const clients = await getGoogleClientsForWorkspace(workspaceId, options);

  const batches = await Promise.all(
    clients.map(async (client) => {
      try {
        const calendarIds = await listCalendarIds(
          client.accessToken,
          client.busyCalendarIds,
          client.calendarId,
        );
        return await freeBusyForClient({
          accessToken: client.accessToken,
          calendarIds,
          from,
          to,
        });
      } catch {
        // One broken secondary account shouldn't wipe availability entirely.
        return [];
      }
    }),
  );

  return batches
    .flat()
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
