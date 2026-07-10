import 'server-only';

import {
  getConferencingConnectionForWorkspace,
  getConferencingProvider,
  locationTypeToConferencingProvider,
  type ConferencingProviderId,
} from '@kit/scheduling/conferencing';

export type ProviderMeetingResult =
  | {
      ok: true;
      joinUrl: string;
      providerMeetingId: string;
      provider: ConferencingProviderId;
    }
  | {
      ok: false;
      provider: ConferencingProviderId;
      reason: string;
    }
  | null;

/**
 * Create a Zoom/Teams meeting when the event location requires it.
 * Returns null for google_meet / phone / etc. Failures are returned as
 * `{ ok: false }` so the booking can continue without a fake link.
 */
export async function tryCreateProviderMeeting(input: {
  accountId: string;
  bookingId: string;
  locationType: string;
  summary: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  inviteeEmail: string;
  inviteeName: string;
  guestEmails?: string[];
}): Promise<ProviderMeetingResult> {
  const providerId = locationTypeToConferencingProvider(input.locationType);
  if (!providerId) return null;

  try {
    const connection = await getConferencingConnectionForWorkspace(
      input.accountId,
      providerId,
    );
    const provider = getConferencingProvider(providerId);
    const meeting = await provider.createMeeting({
      booking: {
        id: input.bookingId,
        accountId: input.accountId,
        summary: input.summary,
        description: input.description,
        startAt: input.startAt,
        endAt: input.endAt,
        timezone: input.timezone,
        inviteeEmail: input.inviteeEmail,
        inviteeName: input.inviteeName,
        guestEmails: input.guestEmails,
      },
      connection,
    });

    return {
      ok: true,
      joinUrl: meeting.joinUrl,
      providerMeetingId: meeting.providerMeetingId,
      provider: providerId,
    };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : `Could not create ${providerId} meeting`;
    console.error('[conferencing] createMeeting failed', {
      provider: providerId,
      accountId: input.accountId,
      bookingId: input.bookingId,
      reason,
    });
    return { ok: false, provider: providerId, reason };
  }
}

export async function tryDeleteProviderMeeting(input: {
  accountId: string;
  locationType: string;
  providerMeetingId: string | null;
}) {
  if (!input.providerMeetingId) return;

  const providerId = locationTypeToConferencingProvider(input.locationType);
  if (!providerId) return;

  try {
    const connection = await getConferencingConnectionForWorkspace(
      input.accountId,
      providerId,
    );
    const provider = getConferencingProvider(providerId);
    await provider.deleteMeeting({
      providerMeetingId: input.providerMeetingId,
      connection,
    });
  } catch (error) {
    console.error('[conferencing] deleteMeeting failed', error);
  }
}
