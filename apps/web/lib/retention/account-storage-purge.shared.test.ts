import { describe, expect, it } from 'vitest';

import {
  daysUntilPurge,
  nextPurgeNotice,
} from './account-storage-purge.shared';

describe('nextPurgeNotice', () => {
  it('sends the 14-day warning first', () => {
    expect(
      nextPurgeNotice({
        daysLeft: 14,
        notice14dSent: false,
        notice3dSent: false,
      }),
    ).toBe('notice_14d');
  });

  it('sends the 3-day warning closer to deletion', () => {
    expect(
      nextPurgeNotice({
        daysLeft: 3,
        notice14dSent: true,
        notice3dSent: false,
      }),
    ).toBe('notice_3d');
  });

  it('catches up the 14-day warning if the cron missed the exact day', () => {
    expect(
      nextPurgeNotice({
        daysLeft: 10,
        notice14dSent: false,
        notice3dSent: false,
      }),
    ).toBe('notice_14d');
  });

  it('sends only the 3-day warning when both are still due', () => {
    expect(
      nextPurgeNotice({
        daysLeft: 2,
        notice14dSent: false,
        notice3dSent: false,
      }),
    ).toBe('notice_3d');
  });

  it('does not send a 14-day warning after the 3-day notice', () => {
    expect(
      nextPurgeNotice({
        daysLeft: 1,
        notice14dSent: false,
        notice3dSent: true,
      }),
    ).toBeNull();
  });

  it('does not send after the wipe date', () => {
    expect(
      nextPurgeNotice({
        daysLeft: 0,
        notice14dSent: false,
        notice3dSent: false,
      }),
    ).toBeNull();
  });
});

describe('daysUntilPurge', () => {
  it('rounds up remaining calendar days', () => {
    const now = new Date('2026-08-18T08:00:00.000Z');
    const purgeAfter = new Date('2026-09-17T08:00:00.000Z');
    expect(daysUntilPurge(purgeAfter, now)).toBe(30);
  });
});
