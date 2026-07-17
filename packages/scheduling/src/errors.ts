/**
 * Thrown when Google Calendar tokens cannot be refreshed and the host must
 * reconnect OAuth (missing refresh token or revoked consent).
 */
export class GoogleCalendarReconnectRequiredError extends Error {
  readonly code = 'GOOGLE_CALENDAR_RECONNECT_REQUIRED' as const;
  readonly workspaceId: string;
  readonly userId: string | null;

  constructor(input: {
    workspaceId: string;
    userId?: string | null;
    message?: string;
  }) {
    super(
      input.message ??
        'Google Calendar needs to be reconnected (refresh token missing or invalid).',
    );
    this.name = 'GoogleCalendarReconnectRequiredError';
    this.workspaceId = input.workspaceId;
    this.userId = input.userId ?? null;
  }
}

export class GoogleCalendarNotConnectedError extends Error {
  readonly code = 'GOOGLE_CALENDAR_NOT_CONNECTED' as const;
  readonly workspaceId: string;
  readonly userId: string | null;

  constructor(input: {
    workspaceId: string;
    userId?: string | null;
    message?: string;
  }) {
    super(
      input.message ??
        'Google Calendar is not connected for this workspace host.',
    );
    this.name = 'GoogleCalendarNotConnectedError';
    this.workspaceId = input.workspaceId;
    this.userId = input.userId ?? null;
  }
}

export function isGoogleCalendarReconnectRequiredError(
  error: unknown,
): error is GoogleCalendarReconnectRequiredError {
  return (
    error instanceof GoogleCalendarReconnectRequiredError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code ===
        'GOOGLE_CALENDAR_RECONNECT_REQUIRED')
  );
}
