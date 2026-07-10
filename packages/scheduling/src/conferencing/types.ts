/**
 * Conferencing provider abstraction (Zoom / Teams).
 *
 * Auth is intentionally outside this interface: callers supply a ready
 * `ConferencingConnectionCredentials` (today from `conferencing_connections`
 * with refresh). If we adopt Composio AgentAuth later, swap the connection
 * loader — keep these create/delete implementations.
 */

export type ConferencingProviderId = 'zoom' | 'teams';

export type ConferencingMeetingBooking = {
  id: string;
  accountId: string;
  summary: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  inviteeEmail: string;
  inviteeName: string;
  guestEmails?: string[];
};

/**
 * Decrypted credentials ready for API calls.
 * How tokens were obtained (direct OAuth vs Composio) must not leak here.
 */
export type ConferencingConnectionCredentials = {
  accountId: string;
  provider: ConferencingProviderId;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  providerAccountEmail: string | null;
};

export type CreateMeetingResult = {
  joinUrl: string;
  providerMeetingId: string;
};

export interface ConferencingProvider {
  readonly id: ConferencingProviderId;

  createMeeting(input: {
    booking: ConferencingMeetingBooking;
    connection: ConferencingConnectionCredentials;
  }): Promise<CreateMeetingResult>;

  deleteMeeting(input: {
    providerMeetingId: string;
    connection: ConferencingConnectionCredentials;
  }): Promise<void>;
}
