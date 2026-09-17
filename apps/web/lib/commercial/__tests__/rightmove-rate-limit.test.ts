import { describe, expect, it } from 'vitest';

import {
  isRightmoveRateLimitError,
  publicationLooksRateLimited,
} from '../rightmove-rate-limit';

describe('isRightmoveRateLimitError', () => {
  it('detects HTTP 429 even without a rate-limit phrase', () => {
    expect(
      isRightmoveRateLimitError({
        httpStatus: 429,
        message: 'Rightmove PUT failed (429): quota exceeded',
      }),
    ).toBe(true);
    expect(
      isRightmoveRateLimitError({
        httpStatus: 429,
        message: 'unrelated message',
      }),
    ).toBe(true);
    expect(
      isRightmoveRateLimitError({
        message: 'Rightmove PUT failed (429): something else',
      }),
    ).toBe(true);
  });

  it('detects rate-limit wording', () => {
    expect(
      isRightmoveRateLimitError({
        message: 'Too Many Requests — rate limit',
      }),
    ).toBe(true);
  });

  it('ignores ordinary publish failures', () => {
    expect(
      isRightmoveRateLimitError({
        httpStatus: 400,
        message: 'Rightmove PUT failed (400): missing address',
      }),
    ).toBe(false);
    expect(isRightmoveRateLimitError({ message: null })).toBe(false);
  });
});

describe('publicationLooksRateLimited', () => {
  it('reads httpStatus from publication metadata', () => {
    expect(
      publicationLooksRateLimited({
        last_error: 'Rightmove PUT failed',
        metadata: { httpStatus: 429 },
      }),
    ).toBe(true);
  });

  it('accepts camelCase lastError from mapped rows', () => {
    expect(
      publicationLooksRateLimited({
        lastError: 'Rightmove PUT failed (429)',
      }),
    ).toBe(true);
  });
});
