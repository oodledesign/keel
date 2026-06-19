import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  findRecorderCalendarEventAt,
  type RecorderCalendarEvent,
} from '~/lib/integrations/google-calendar/events';

export type MeetingCalendarMetadata = {
  calendar_event_id: string | null;
  calendar_event_start: string | null;
  calendar_event_end: string | null;
  calendar_attendees: Array<{ name: string; email: string }>;
};

function normalizeAttendees(event: RecorderCalendarEvent) {
  return event.attendees
    .map((attendee) => ({
      name: attendee.name.trim() || attendee.email.trim() || 'Guest',
      email: attendee.email.trim(),
    }))
    .filter((attendee) => attendee.email.length > 0);
}

export async function resolveMeetingCalendarMetadata(
  admin: SupabaseClient,
  input: { userId: string; recordedAt: Date | null },
): Promise<MeetingCalendarMetadata> {
  const empty: MeetingCalendarMetadata = {
    calendar_event_id: null,
    calendar_event_start: null,
    calendar_event_end: null,
    calendar_attendees: [],
  };

  if (!input.recordedAt || Number.isNaN(input.recordedAt.getTime())) {
    return empty;
  }

  const event = await findRecorderCalendarEventAt(admin, {
    userId: input.userId,
    instant: input.recordedAt,
  });

  if (!event) {
    return empty;
  }

  return {
    calendar_event_id: event.id,
    calendar_event_start: event.start,
    calendar_event_end: event.end,
    calendar_attendees: normalizeAttendees(event),
  };
}
