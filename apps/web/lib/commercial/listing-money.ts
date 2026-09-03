/** Display helpers for disposal list/map money. */

export function rentFrequencySuffix(
  frequency: string | null | undefined,
): 'pcm' | 'pa' {
  return frequency === 'per_month' ? 'pcm' : 'pa';
}

function formatGbp(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

/** Asking rent amount only (range when from ≠ to). Null if neither bound is set. */
export function formatListingRentAmount(
  fromPence: number | null | undefined,
  toPence: number | null | undefined,
): string | null {
  if (fromPence == null && toPence == null) return null;
  if (fromPence != null && toPence != null && fromPence !== toPence) {
    return `${formatGbp(fromPence)}–${formatGbp(toPence)}`;
  }
  return formatGbp((fromPence ?? toPence)!);
}

export function formatListingRent(
  fromPence: number | null | undefined,
  toPence: number | null | undefined,
  frequency: string | null | undefined,
): string | null {
  const amount = formatListingRentAmount(fromPence, toPence);
  if (!amount) return null;
  return `${amount} ${rentFrequencySuffix(frequency)}`;
}
