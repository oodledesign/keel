import { describe, expect, it } from 'vitest';

import {
  INSUFFICIENT_AI_CREDITS_CODE,
  isInsufficientAiCreditsMessage,
  isInsufficientAiCreditsPayload,
} from './ai-credits-exhausted';

describe('ai-credits-exhausted helpers', () => {
  it('detects structured payload', () => {
    expect(
      isInsufficientAiCreditsPayload({
        code: INSUFFICIENT_AI_CREDITS_CODE,
        error: 'Insufficient AI credits: need 5, have 0',
        creditsRemaining: 0,
        creditsRequired: 5,
      }),
    ).toBe(true);

    expect(
      isInsufficientAiCreditsPayload({
        error: 'Insufficient AI credits: need 5, have 0',
      }),
    ).toBe(false);
  });

  it('detects message variants', () => {
    expect(
      isInsufficientAiCreditsMessage(
        'Not enough AI credits (need 2, have 0). [INSUFFICIENT_AI_CREDITS]',
      ),
    ).toBe(true);
    expect(isInsufficientAiCreditsMessage('Something else')).toBe(false);
  });
});
