import { describe, expect, it } from 'vitest';

import {
  isAuthRetryableFetchError,
  isTransientSupabaseError,
} from './transient-errors';

describe('isTransientSupabaseError', () => {
  it('detects AuthRetryableFetchError', () => {
    expect(
      isTransientSupabaseError({ name: 'AuthRetryableFetchError', status: 504 }),
    ).toBe(true);
  });

  it('detects statement timeout codes', () => {
    expect(isTransientSupabaseError({ code: '57014', message: 'timeout' })).toBe(
      true,
    );
  });

  it('ignores invalid token errors', () => {
    expect(
      isTransientSupabaseError({
        code: 'refresh_token_not_found',
        message: 'Invalid Refresh Token',
      }),
    ).toBe(false);
  });
});

describe('isAuthRetryableFetchError', () => {
  it('detects 503 auth fetch failures', () => {
    expect(isAuthRetryableFetchError({ name: 'AuthRetryableFetchError' })).toBe(
      true,
    );
    expect(isAuthRetryableFetchError({ status: 503 })).toBe(true);
  });
});
