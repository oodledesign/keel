/**
 * Map AI provider failures to safe user-facing copy.
 * Never leak Google/Anthropic quota URLs, billing consoles, or raw API payloads.
 */

export const AI_PROVIDER_UNAVAILABLE_MESSAGE =
  'AI is temporarily unavailable. Please get in touch with support.';

const PROVIDER_QUOTA_OR_BILLING_RE =
  /resource[_\s-]?exhausted|exceeded your current quota|check your plan and billing|quota exceeded|insufficient[_ ]quota|credit balance is too low|billing details|rate[_ ]?limit|too many requests|\boverloaded(?:_error)?\b|ai\.google\.dev|generativelanguage\.googleapis|makersuite\.google|console\.cloud\.google\.com\/billing|platform\.openai\.com\/account\/billing|anthropic\.com\/.*billing/i;

const URL_RE = /https?:\/\/[^\s)\]>'"]+/i;

function errorHaystack(error: unknown): string {
  if (typeof error === 'string') return error;

  if (error instanceof Error) {
    const extras: string[] = [error.message, error.name];
    const anyErr = error as Error & {
      status?: unknown;
      statusCode?: unknown;
      code?: unknown;
      cause?: unknown;
    };

    if (anyErr.status != null) extras.push(String(anyErr.status));
    if (anyErr.statusCode != null) extras.push(String(anyErr.statusCode));
    if (anyErr.code != null) extras.push(String(anyErr.code));
    if (anyErr.cause != null) extras.push(errorHaystack(anyErr.cause));

    return extras.join(' ');
  }

  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return '';
    }
  }

  return '';
}

/** True when the failure looks like provider-side quota, billing, or rate limits. */
export function isAiProviderQuotaOrBillingError(error: unknown): boolean {
  const haystack = errorHaystack(error);
  if (!haystack) return false;

  if (PROVIDER_QUOTA_OR_BILLING_RE.test(haystack)) {
    return true;
  }

  const anyErr = error as { status?: unknown; statusCode?: unknown } | null;
  const status =
    typeof anyErr?.status === 'number'
      ? anyErr.status
      : typeof anyErr?.statusCode === 'number'
        ? anyErr.statusCode
        : null;

  // 429 is almost always rate/quota; avoid treating every 503 as billing.
  return status === 429;
}

/**
 * Return copy safe to show in toasts / API error payloads.
 * Provider quota/billing → ask user to contact support.
 * Other messages that include provider URLs or look like raw API dumps → generic fallback.
 */
export function formatUserFacingAiError(
  error: unknown,
  fallback = 'Something went wrong with AI. Please try again.',
): string {
  if (isAiProviderQuotaOrBillingError(error)) {
    return AI_PROVIDER_UNAVAILABLE_MESSAGE;
  }

  const message =
    error instanceof Error
      ? error.message.trim()
      : typeof error === 'string'
        ? error.trim()
        : '';

  if (!message) return fallback;

  // Never surface third-party docs/console links or JSON-ish provider dumps.
  if (URL_RE.test(message) || /^[\[{]/.test(message) || message.length > 280) {
    return fallback;
  }

  return message;
}
