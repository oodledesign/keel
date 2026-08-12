/** Client-safe currency formatter (no server-only imports). */
export function formatVisionPence(pence: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(pence / 100);
}
