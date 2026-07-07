/**
 * Detect Supabase/PostgREST/Auth errors that are likely transient (overload, timeout).
 * Used to avoid treating DB outages as auth failures (401) or clearing sessions.
 */
export function isTransientSupabaseError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as {
    name?: string;
    code?: string;
    message?: string;
    status?: number;
    cause?: unknown;
  };

  if (err.name === 'AuthRetryableFetchError') {
    return true;
  }

  const status = err.status ?? extractHttpStatus(err.message);
  if (status === 502 || status === 503 || status === 504 || status === 429) {
    return true;
  }

  const code = err.code?.toUpperCase() ?? '';
  if (
    code === '57014' || // statement timeout
    code === 'PGRST301' || // connection pool timeout
    code === 'PGRST003' || // request timeout
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED'
  ) {
    return true;
  }

  const message = (err.message ?? '').toLowerCase();
  if (
    message.includes('statement timeout') ||
    message.includes('connection pool') ||
    message.includes('upstream request timeout') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('503') ||
    message.includes('504')
  ) {
    return true;
  }

  if (err.cause && isTransientSupabaseError(err.cause)) {
    return true;
  }

  return false;
}

function extractHttpStatus(message: string | undefined): number | undefined {
  if (!message) return undefined;
  const match = /\b(502|503|504|429)\b/.exec(message);
  return match ? Number(match[1]) : undefined;
}

export function isAuthRetryableFetchError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { name?: string; status?: number };
  return (
    err.name === 'AuthRetryableFetchError' ||
    err.status === 502 ||
    err.status === 503 ||
    err.status === 504 ||
    err.status === 429
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry an async operation on transient Supabase/Auth failures with backoff. */
export async function withTransientRetry<T>(
  operation: () => Promise<T>,
  options?: { attempts?: number; delaysMs?: number[] },
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  const delaysMs = options?.delaysMs ?? [0, 250, 750];
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable =
        isTransientSupabaseError(error) || isAuthRetryableFetchError(error);
      if (!retryable || attempt === attempts - 1) {
        throw error;
      }
      const delay = delaysMs[attempt] ?? delaysMs[delaysMs.length - 1] ?? 500;
      if (delay > 0) {
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
