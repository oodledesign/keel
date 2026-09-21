const MS_PER_DAY = 86_400_000;

/** Whole calendar days from `now` to `isoDate` (local date, not time-of-day). */
export function calendarDaysUntil(
  isoDate: string,
  now: Date = new Date(),
): number | null {
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;

  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );

  return Math.round(
    (startTarget.getTime() - startToday.getTime()) / MS_PER_DAY,
  );
}

export function portalCreditsResetCopy(
  nextRenewalDate: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!nextRenewalDate) return 'No renewal set';

  const days = calendarDaysUntil(nextRenewalDate, now);
  if (days === null) return 'No renewal set';
  if (days <= 0) return 'Resets today';
  if (days === 1) return 'Resets in 1 day';
  return `Resets in ${days} days`;
}
