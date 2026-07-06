import { describe, expect, it } from 'vitest';

import {
  MAX_ACTIVITY_BLOCKS_PER_UPLOAD,
  normalizeActivityBlockInput,
} from '~/lib/recorder/activity-blocks';

describe('normalizeActivityBlockInput', () => {
  const baseBlock = {
    app_name: 'Safari',
    bundle_id: 'com.apple.Safari',
    domain: 'github.com',
    url: 'https://github.com/keel/keel/pulls',
    window_title: 'Pull requests',
    started_at: '2026-07-06T10:00:00.000Z',
    ended_at: '2026-07-06T10:05:00.000Z',
    duration_seconds: 300,
  };

  it('strips full URLs when capture_full_urls is disabled', () => {
    const normalized = normalizeActivityBlockInput(baseBlock, {
      tracking_enabled: true,
      capture_full_urls: false,
    });

    expect(normalized.url).toBeNull();
    expect(normalized.domain).toBe('github.com');
  });

  it('keeps full URLs when capture_full_urls is enabled', () => {
    const normalized = normalizeActivityBlockInput(baseBlock, {
      tracking_enabled: true,
      capture_full_urls: true,
    });

    expect(normalized.url).toBe('https://github.com/keel/keel/pulls');
  });

  it('rejects invalid timestamps', () => {
    expect(() =>
      normalizeActivityBlockInput(
        { ...baseBlock, started_at: 'not-a-date' },
        { tracking_enabled: true, capture_full_urls: false },
      ),
    ).toThrow('Invalid started_at');
  });

  it('rejects ended_at before started_at', () => {
    expect(() =>
      normalizeActivityBlockInput(
        {
          ...baseBlock,
          started_at: '2026-07-06T10:05:00.000Z',
          ended_at: '2026-07-06T10:00:00.000Z',
        },
        { tracking_enabled: true, capture_full_urls: false },
      ),
    ).toThrow('ended_at must be on or after started_at');
  });
});

describe('activity upload limits', () => {
  it('caps batch size at 250 blocks', () => {
    expect(MAX_ACTIVITY_BLOCKS_PER_UPLOAD).toBe(250);
  });
});
