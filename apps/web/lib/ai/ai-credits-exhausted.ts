export const INSUFFICIENT_AI_CREDITS_CODE = 'INSUFFICIENT_AI_CREDITS' as const;

export type InsufficientAiCreditsPayload = {
  code: typeof INSUFFICIENT_AI_CREDITS_CODE;
  error: string;
  creditsRemaining: number;
  creditsRequired: number;
};

export function isInsufficientAiCreditsPayload(
  value: unknown,
): value is InsufficientAiCreditsPayload {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    row.code === INSUFFICIENT_AI_CREDITS_CODE &&
    typeof row.error === 'string' &&
    typeof row.creditsRemaining === 'number' &&
    typeof row.creditsRequired === 'number'
  );
}

export function isInsufficientAiCreditsMessage(
  message: string | null | undefined,
) {
  if (!message) return false;
  return (
    /insufficient ai credits|not enough ai credits/i.test(message) ||
    message.includes('INSUFFICIENT_AI_CREDITS')
  );
}

export function getAiCreditsExhaustedStorageKey(accountId: string) {
  return `ozer:ai-credits-exhausted:${accountId}`;
}
