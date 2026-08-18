const MS_HOUR = 60 * 60 * 1000;
export const RENEWAL_WINDOW_HOURS = 36;

export function isWithinRenewalNoticeWindow(
  periodEndsAt: Date,
  now = new Date(),
  windowHours = RENEWAL_WINDOW_HOURS,
): boolean {
  const msLeft = periodEndsAt.getTime() - now.getTime();
  return msLeft > 0 && msLeft <= windowHours * MS_HOUR;
}

export function formatChargeAmount(
  amountMinor: number,
  currency: string,
): string {
  const code = currency.trim().toUpperCase() || 'GBP';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: code,
  }).format(amountMinor / 100);
}
