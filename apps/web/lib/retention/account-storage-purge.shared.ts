const MS_DAY = 24 * 60 * 60 * 1000;

export type PurgeNoticeKind = 'notice_14d' | 'notice_3d';

export function daysUntilPurge(purgeAfter: Date, now = new Date()): number {
  return Math.ceil((purgeAfter.getTime() - now.getTime()) / MS_DAY);
}

export function formatPurgeDate(purgeAfter: Date): string {
  return purgeAfter.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** 14-day then 3-day warnings before the 30-day storage wipe. */
export function nextPurgeNotice(input: {
  daysLeft: number;
  notice14dSent: boolean;
  notice3dSent: boolean;
}): PurgeNoticeKind | null {
  if (input.daysLeft <= 0) return null;
  if (input.daysLeft <= 3 && !input.notice3dSent) return 'notice_3d';
  // Once the 3-day warning has gone, never send a belated 14-day email.
  if (input.daysLeft <= 14 && !input.notice14dSent && !input.notice3dSent) {
    return 'notice_14d';
  }
  return null;
}
