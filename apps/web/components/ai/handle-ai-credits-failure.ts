'use client';

import {
  INSUFFICIENT_AI_CREDITS_CODE,
  isInsufficientAiCreditsMessage,
  isInsufficientAiCreditsPayload,
} from '~/lib/ai/ai-credits-exhausted';

import {
  type ReportAiCreditsExhaustedInput,
  useReportAiCreditsExhausted,
} from './ai-credits-exhausted-context';

export type HandleAiCreditsFailureOptions = {
  accountId: string;
  billingHref: string;
  status?: number;
  body?: unknown;
  message?: string | null;
  report?: (input: ReportAiCreditsExhaustedInput) => void;
};

/**
 * Returns true when the failure was an insufficient-credits case and was reported.
 */
export function handleAiCreditsFailure(
  report: (input: ReportAiCreditsExhaustedInput) => void,
  options: Omit<HandleAiCreditsFailureOptions, 'report'>,
): boolean {
  const payload =
    options.body && typeof options.body === 'object'
      ? (options.body as Record<string, unknown>)
      : null;

  const code = typeof payload?.code === 'string' ? payload.code : null;
  const byCode =
    payload && isInsufficientAiCreditsPayload(payload) ? payload : null;
  const message =
    options.message ??
    (typeof payload?.error === 'string' ? payload.error : null);
  const byMessage = isInsufficientAiCreditsMessage(message);
  const byKnownCode = code === INSUFFICIENT_AI_CREDITS_CODE;
  const byStatus =
    options.status === 402 &&
    code !== 'INSUFFICIENT_MEDIA_CREDITS' &&
    (byKnownCode || byMessage || code == null);

  if (!byCode && !byKnownCode && !byStatus && !byMessage) {
    return false;
  }

  report({
    accountId: options.accountId,
    billingHref: options.billingHref,
    creditsRemaining:
      typeof byCode?.creditsRemaining === 'number'
        ? byCode.creditsRemaining
        : typeof payload?.creditsRemaining === 'number'
          ? payload.creditsRemaining
          : undefined,
    creditsRequired:
      typeof byCode?.creditsRequired === 'number'
        ? byCode.creditsRequired
        : typeof payload?.creditsRequired === 'number'
          ? payload.creditsRequired
          : undefined,
    error:
      typeof byCode?.error === 'string'
        ? byCode.error
        : typeof payload?.error === 'string'
          ? payload.error
          : (options.message ?? undefined),
  });

  return true;
}

/** Hook wrapper for interactive clients. */
export function useHandleAiCreditsFailure() {
  const report = useReportAiCreditsExhausted();
  return (options: Omit<HandleAiCreditsFailureOptions, 'report'>) =>
    handleAiCreditsFailure(report, options);
}
