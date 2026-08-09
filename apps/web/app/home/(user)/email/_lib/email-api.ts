type ApiSuccess<T> = { ok: true; data: T };
type ApiFailure = {
  ok: false;
  error: { code: string; message: string };
};

export class EmailApiError extends Error {
  code: string;
  creditsRemaining?: number;
  creditsRequired?: number;

  constructor(
    code: string,
    message: string,
    extras?: { creditsRemaining?: number; creditsRequired?: number },
  ) {
    super(message);
    this.code = code;
    this.creditsRemaining = extras?.creditsRemaining;
    this.creditsRequired = extras?.creditsRequired;
  }
}

/** Safari often surfaces aborted/long fetches as a bare "Load failed". */
export function formatEmailApiError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Request failed';

  if (
    /^load failed$/i.test(message.trim()) ||
    /failed to fetch|networkerror|network request failed|aborted|the operation was aborted/i.test(
      message,
    )
  ) {
    return 'Connection interrupted while syncing. Tap Sync again — large inboxes can take a minute.';
  }

  return message;
}

export async function emailApiFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  let raw: unknown;

  try {
    raw = await response.json();
  } catch {
    if (response.status === 504 || response.status === 408) {
      throw new EmailApiError(
        'TIMEOUT',
        'Sync timed out. Tap Sync again — large inboxes can take a minute.',
      );
    }

    throw new EmailApiError(
      'INVALID_RESPONSE',
      response.ok
        ? 'Unexpected response from email API'
        : `Request failed (${response.status})`,
    );
  }

  if (
    raw &&
    typeof raw === 'object' &&
    ((raw as { code?: string }).code === 'INSUFFICIENT_AI_CREDITS' ||
      response.status === 402)
  ) {
    const row = raw as {
      code?: string;
      error?: unknown;
      creditsRemaining?: number;
      creditsRequired?: number;
    };
    const message =
      typeof row.error === 'string'
        ? row.error
        : row.error &&
            typeof row.error === 'object' &&
            typeof (row.error as { message?: unknown }).message === 'string'
          ? (row.error as { message: string }).message
          : 'Insufficient AI credits';

    if (
      row.code === 'INSUFFICIENT_AI_CREDITS' ||
      /insufficient ai credits/i.test(message) ||
      response.status === 402
    ) {
      throw new EmailApiError('INSUFFICIENT_AI_CREDITS', message, {
        creditsRemaining: row.creditsRemaining,
        creditsRequired: row.creditsRequired,
      });
    }
  }

  const payload = raw as ApiSuccess<T> | ApiFailure;

  if (!payload || typeof payload !== 'object' || !('ok' in payload)) {
    throw new EmailApiError(
      'INVALID_RESPONSE',
      response.ok
        ? 'Unexpected response from email API'
        : `Request failed (${response.status})`,
    );
  }

  if (!payload.ok) {
    throw new EmailApiError(payload.error.code, payload.error.message);
  }

  return payload.data;
}
