type ApiSuccess<T> = { ok: true; data: T };
type ApiFailure = {
  ok: false;
  error: { code: string; message: string };
};

export class EmailApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
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

  let payload: ApiSuccess<T> | ApiFailure;

  try {
    payload = (await response.json()) as ApiSuccess<T> | ApiFailure;
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

  if (!payload.ok) {
    throw new EmailApiError(payload.error.code, payload.error.message);
  }

  return payload.data;
}
