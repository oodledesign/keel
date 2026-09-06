const FALLBACK = 'Could not create your workspace. Please try again.';

const INTERNAL_ERROR =
  /PGRST|SQLSTATE|postgres|permission denied|column .* does not exist|schema cache|relation |violates|duplicate key|trigger|udf_|function public\.|undefined_column|22P02|23505|23503|23514|42703|42P01|digest|server components render|omitted in production/i;

/**
 * User-visible onboarding error. Strips PostgREST / Postgres / Next.js digest
 * text so production never shows a blank RSC crash.
 */
export function toPublicOnboardingError(
  error: unknown,
  fallback = FALLBACK,
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  const message = raw.trim();
  if (!message) {
    return fallback;
  }

  if (
    INTERNAL_ERROR.test(message) ||
    message.length > 160 ||
    /[{[]/.test(message)
  ) {
    return fallback;
  }

  return message;
}

export function isNextProductionDigestMessage(message: string): boolean {
  return /server components render|omitted in production|digest/i.test(message);
}
