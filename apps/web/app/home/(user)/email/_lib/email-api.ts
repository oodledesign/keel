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
