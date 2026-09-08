import { describe, expect, it } from 'vitest';

import { isRightmoveBulkJobStale } from '../rightmove-bulk-job-types';
import {
  collectRightmoveUrls,
  formatRightmovePublicationStatus,
  rightmovePublicationStatusBadgeClass,
} from '../rightmove-publish-status';

describe('collectRightmoveUrls', () => {
  it('keeps a safe external URL and ignores junk', () => {
    expect(
      collectRightmoveUrls({
        externalUrl: 'https://www.rightmove.co.uk/properties/1',
        metadata: {
          displayUrl: 'javascript:alert(1)',
          links: { extra: 'https://www.adftest.rightmove.com/properties/1' },
        },
      }),
    ).toEqual([
      'https://www.rightmove.co.uk/properties/1',
      'https://www.adftest.rightmove.com/properties/1',
    ]);
  });

  it('dedupes the same URL from metadata', () => {
    expect(
      collectRightmoveUrls({
        externalUrl: 'https://www.rightmove.co.uk/properties/1',
        metadata: {
          displayUrl: 'https://www.rightmove.co.uk/properties/1',
        },
      }),
    ).toEqual(['https://www.rightmove.co.uk/properties/1']);
  });
});

describe('formatRightmovePublicationStatus', () => {
  it('labels stored portal statuses', () => {
    expect(formatRightmovePublicationStatus('published')).toBe('Published');
    expect(formatRightmovePublicationStatus(null)).toBe('Not pushed');
    expect(formatRightmovePublicationStatus('error')).toBe('Failed');
  });
});

describe('rightmovePublicationStatusBadgeClass', () => {
  it('uses distinct tones for published, not pushed, and failed', () => {
    const published = rightmovePublicationStatusBadgeClass('published');
    const notPushed = rightmovePublicationStatusBadgeClass(null);
    const failed = rightmovePublicationStatusBadgeClass('error');

    expect(published).toMatch(/emerald/);
    expect(notPushed).toMatch(/amber/);
    expect(failed).toMatch(/rose/);
    expect(published).not.toBe(notPushed);
    expect(notPushed).not.toBe(failed);
  });
});

describe('isRightmoveBulkJobStale', () => {
  it('treats a recent running heartbeat as fresh', () => {
    const now = Date.parse('2026-09-07T12:00:00.000Z');
    expect(
      isRightmoveBulkJobStale(
        {
          status: 'running',
          heartbeatAt: '2026-09-07T11:59:30.000Z',
          lockedUntil: '2026-09-07T12:01:00.000Z',
        },
        now,
      ),
    ).toBe(false);
  });

  it('treats an old heartbeat as stale so the page can resume', () => {
    const now = Date.parse('2026-09-07T12:00:00.000Z');
    expect(
      isRightmoveBulkJobStale(
        {
          status: 'running',
          heartbeatAt: '2026-09-07T11:58:00.000Z',
          lockedUntil: '2026-09-07T11:59:00.000Z',
        },
        now,
      ),
    ).toBe(true);
  });
});
