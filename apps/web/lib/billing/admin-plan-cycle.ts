function parseIsoDate(value: string): { y: number; m: number; d: number } {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return { y: y!, m: m! - 1, d: d! };
}

function formatIsoDate(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

/** Adds calendar months to a YYYY-MM-DD date, clamping to the month's last day. */
export function addMonthsToIsoDate(value: string, months: number): string {
  const { y, m, d } = parseIsoDate(value);
  const lastDay = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();
  return formatIsoDate(y, m + months, Math.min(d, lastDay));
}

/**
 * Next monthly cycle for an admin-applied plan whose cycle has ended, rolled
 * forward past any missed months. Null while the current cycle is still live.
 */
export function nextAdminPlanCycle(
  cycleEnd: string | null,
  now: Date,
): { cycleStart: string; cycleEnd: string } | null {
  const today = now.toISOString().slice(0, 10);
  if (cycleEnd && cycleEnd > today) return null;

  let start = cycleEnd ?? today;
  let months = 1;
  let end = addMonthsToIsoDate(start, months);
  while (end <= today) {
    start = end;
    months += 1;
    end = addMonthsToIsoDate(cycleEnd ?? today, months);
  }

  return { cycleStart: start, cycleEnd: end };
}

/** Batches for a cycle expire at the start of its end date (UTC). */
export function adminPlanCycleExpiresAt(cycleEnd: string): string {
  return `${cycleEnd}T00:00:00.000Z`;
}
