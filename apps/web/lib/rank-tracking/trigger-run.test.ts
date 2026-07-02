import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRankCheckRunUrl } from './trigger-run';

describe('getRankCheckRunUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the app site origin so workers hit app.ozer.so after marketing split', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_SITE_URL', 'https://app.ozer.so');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://www.ozer.so');

    expect(getRankCheckRunUrl('job-123')).toBe(
      'https://app.ozer.so/api/rankly/rank-check/job-123/run',
    );
  });
});
