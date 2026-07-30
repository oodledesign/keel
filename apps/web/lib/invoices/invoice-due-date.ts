/** Add calendar days to a YYYY-MM-DD or ISO date; returns ISO date string (UTC noon). */
export function addDaysIso(dateInput: string | Date, days: number): string {
  const base =
    dateInput instanceof Date
      ? new Date(dateInput.getTime())
      : new Date(
          dateInput.includes('T')
            ? dateInput
            : `${dateInput.slice(0, 10)}T12:00:00.000Z`,
        );
  if (Number.isNaN(base.getTime())) {
    throw new Error('Invalid date');
  }
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

export function addDaysYmd(dateInput: string | Date, days: number): string {
  return addDaysIso(dateInput, days).slice(0, 10);
}

export function clampDueDays(value: unknown, fallback = 7): number {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(365, Math.max(0, Math.round(n)));
}
