/** Rightmove quota resets every 60 seconds; exact limit is unpublished. */
export const RIGHTMOVE_RATE_LIMIT_WINDOW_MS = 60_000;

/** In-batch retry wait. Cron budget is short, so this is less than the 60s reset. */
export const RIGHTMOVE_RATE_LIMIT_RETRY_MS = 15_000;

export function isRightmoveRateLimitError(input: {
  message?: string | null;
  httpStatus?: number | null;
}): boolean {
  if (input.httpStatus === 429) return true;
  const haystack = (input.message ?? '').toLowerCase();
  if (!haystack) return false;
  return (
    haystack.includes('rate limit') ||
    haystack.includes('too many requests') ||
    /\b429\b/.test(haystack)
  );
}

export function publicationLooksRateLimited(publication: {
  last_error?: string | null;
  lastError?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const metadata = publication.metadata ?? {};
  const httpStatus =
    typeof metadata.httpStatus === 'number' ? metadata.httpStatus : null;
  return isRightmoveRateLimitError({
    message: publication.last_error ?? publication.lastError,
    httpStatus,
  });
}
