import type {
  ConferencingProvider,
  CreateMeetingResult,
} from '../types';

/**
 * Microsoft Teams online meetings via Graph API.
 * Auth tokens are supplied by the connection loader — not fetched here.
 */
export class TeamsConferencingProvider implements ConferencingProvider {
  readonly id = 'teams' as const;

  async createMeeting(input: {
    booking: {
      summary: string;
      description?: string;
      startAt: Date;
      endAt: Date;
      timezone: string;
      inviteeEmail: string;
      inviteeName: string;
      guestEmails?: string[];
    };
    connection: { accessToken: string };
  }): Promise<CreateMeetingResult> {
    const attendees = [
      {
        upn: input.booking.inviteeEmail,
        role: 'attendee',
      },
      ...(input.booking.guestEmails ?? []).map((email) => ({
        upn: email,
        role: 'attendee' as const,
      })),
    ];

    const res = await fetch(
      'https://graph.microsoft.com/v1.0/me/onlineMeetings',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.connection.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          startDateTime: input.booking.startAt.toISOString(),
          endDateTime: input.booking.endAt.toISOString(),
          subject: input.booking.summary,
          participants: {
            attendees,
          },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!res.ok) {
      throw new Error(
        `Teams create meeting failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
      );
    }

    const created = (await res.json()) as {
      id?: string;
      joinWebUrl?: string;
    };

    if (!created.joinWebUrl || !created.id) {
      throw new Error('Teams did not return a join URL or meeting id');
    }

    return {
      joinUrl: created.joinWebUrl,
      providerMeetingId: created.id,
    };
  }

  async deleteMeeting(input: {
    providerMeetingId: string;
    connection: { accessToken: string };
  }): Promise<void> {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/onlineMeetings/${encodeURIComponent(input.providerMeetingId)}`,
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
        `Teams delete meeting failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
      );
    }
  }
}
