import { describe, expect, it } from 'vitest';

import { portalPublishFailureMessage } from '../portal-publish-result';

describe('portalPublishFailureMessage', () => {
  it('returns the action error string when publish fails', () => {
    expect(
      portalPublishFailureMessage({
        ok: false,
        error: 'Property Hive credentials not configured',
      }),
    ).toBe('Property Hive credentials not configured');
  });

  it('falls back to message when error is missing', () => {
    expect(
      portalPublishFailureMessage({
        ok: false,
        message: 'Feed is not enabled yet',
      }),
    ).toBe('Feed is not enabled yet');
  });

  it('returns null for successful publishes', () => {
    expect(
      portalPublishFailureMessage({
        ok: true,
        message: 'Pushed to Property Hive',
      }),
    ).toBeNull();
  });
});
