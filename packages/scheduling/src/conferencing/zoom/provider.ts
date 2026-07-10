import type {
  ConferencingProvider,
  CreateMeetingResult,
} from '../types';

/**
 * Zoom meetings via user OAuth (meetings:write / meeting:write:meeting).
 * Auth tokens are supplied by the connection loader — not fetched here.
 */
export class ZoomConferencingProvider implements ConferencingProvider {
  readonly id = 'zoom' as const;

  async createMeeting(input: {
    booking: {
      summary: string;
      description?: string;
      startAt: Date;
      endAt: Date;
      timezone: string;
    };
    connection: { accessToken: string };
  }): Promise<CreateMeetingResult> {
    const durationMinutes = Math.max(
      5,
      Math.round(
        (input.booking.endAt.getTime() - input.booking.startAt.getTime()) /
          60_000,
      ),
    );

    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.connection.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        topic: input.booking.summary,
        type: 2,
        start_time: input.booking.startAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        duration: durationMinutes,
        timezone: input.booking.timezone,
        agenda: input.booking.description?.slice(0, 2000) ?? undefined,
        settings: {
          join_before_host: false,
          waiting_room: true,
          meeting_invitees: [],
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      throw new Error(
        `Zoom create meeting failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
      );
    }

    const created = (await res.json()) as {
      id?: number | string;
      join_url?: string;
    };

    if (!created.join_url || created.id == null) {
      throw new Error('Zoom did not return a join URL or meeting id');
    }

    return {
      joinUrl: created.join_url,
      providerMeetingId: String(created.id),
    };
  }

  async deleteMeeting(input: {
    providerMeetingId: string;
    connection: { accessToken: string };
  }): Promise<void> {
    const res = await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(input.providerMeetingId)}`,
      {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${input.connection.accessToken}`,
        },
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!res.ok && res.status !== 404 && res.status !== 204) {
      throw new Error(
        `Zoom delete meeting failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
      );
    }
  }
}
