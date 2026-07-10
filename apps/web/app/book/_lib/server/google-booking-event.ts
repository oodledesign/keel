import 'server-only';

import { randomUUID } from 'node:crypto';

import { getGoogleClientForWorkspace } from '@kit/scheduling/google';

type Attendee = { email: string; name?: string };

/**
 * Create a calendar event on the host's Google Calendar.
 * When `createMeet` is true, requests conferenceData so Google generates a Meet link.
 * When `location` is set (Zoom/Teams join URL), it is stored on the event.
 */
export async function createGoogleBookingCalendarEvent(input: {
  accountId: string;
  hostUserId: string;
  summary: string;
  description: string;
  startAt: Date;
  endAt: Date;
  inviteeTimezone: string;
  attendees: Attendee[];
  createMeet: boolean;
  location?: string | null;
}): Promise<{
  eventId: string;
  conferencingUrl: string | null;
  conferencingProvider: string | null;
}> {
  const google = await getGoogleClientForWorkspace(input.accountId, {
    hostUserId: input.hostUserId,
  });

  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: {
      dateTime: input.startAt.toISOString(),
      timeZone: input.inviteeTimezone,
    },
    end: {
      dateTime: input.endAt.toISOString(),
      timeZone: input.inviteeTimezone,
    },
    attendees: input.attendees.map((attendee) => ({
      email: attendee.email,
      displayName: attendee.name,
    })),
  };

  if (input.location) {
    body.location = input.location;
  }

  if (input.createMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const query = new URLSearchParams({
    conferenceDataVersion: input.createMeet ? '1' : '0',
    sendUpdates: 'all',
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(google.calendarId)}/events?${query}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${google.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!res.ok) {
    throw new Error(
      `Google Calendar create failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  const created = (await res.json()) as {
    id?: string;
    hangoutLink?: string;
    conferenceData?: {
      entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
    };
  };

  if (!created.id) {
    throw new Error('Google Calendar did not return an event id');
  }

  const meetFromEntries = created.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === 'video' && entry.uri,
  )?.uri;

  const conferencingUrl = created.hangoutLink ?? meetFromEntries ?? null;

  return {
    eventId: created.id,
    conferencingUrl,
    conferencingProvider: conferencingUrl ? 'google_meet' : null,
  };
}
