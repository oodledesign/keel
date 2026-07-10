import type { ConferencingProviderId } from './types';

export class ConferencingNotConnectedError extends Error {
  readonly code = 'CONFERENCING_NOT_CONNECTED' as const;
  readonly accountId: string;
  readonly provider: ConferencingProviderId;

  constructor(input: {
    accountId: string;
    provider: ConferencingProviderId;
    message?: string;
  }) {
    super(
      input.message ??
        `${input.provider} is not connected for this workspace.`,
    );
    this.name = 'ConferencingNotConnectedError';
    this.accountId = input.accountId;
    this.provider = input.provider;
  }
}

export class ConferencingReconnectRequiredError extends Error {
  readonly code = 'CONFERENCING_RECONNECT_REQUIRED' as const;
  readonly accountId: string;
  readonly provider: ConferencingProviderId;

  constructor(input: {
    accountId: string;
    provider: ConferencingProviderId;
    message?: string;
  }) {
    super(
      input.message ??
        `${input.provider} needs to be reconnected (refresh token missing or invalid).`,
    );
    this.name = 'ConferencingReconnectRequiredError';
    this.accountId = input.accountId;
    this.provider = input.provider;
  }
}

export function isConferencingReconnectRequiredError(
  error: unknown,
): error is ConferencingReconnectRequiredError {
  return (
    error instanceof ConferencingReconnectRequiredError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'CONFERENCING_RECONNECT_REQUIRED')
  );
}
