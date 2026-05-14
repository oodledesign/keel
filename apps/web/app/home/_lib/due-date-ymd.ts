/**
 * Calendar Y-M-D helpers for Postgres `date` / ISO date strings.
 * Avoid `new Date('YYYY-MM-DD')` (UTC midnight) so labels and comparisons match local calendar days.
 */

export function parseDueDateParts(
  raw: string | null | undefined,
): { y: number; m: number; d: number } | null {
  if (raw == null || String(raw).trim() === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (y < 1970 || y > 2100 || mo < 1 || mo > 12 || day < 1 || day > 31)
    return null;
  return { y, m: mo, d: day };
}

export function toIsoDateString(raw: string | null | undefined): string | null {
  const p = parseDueDateParts(raw);
  if (!p) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function compareYmd(
  a: { y: number; m: number; d: number },
  b: { y: number; m: number; d: number },
): number {
  if (a.y !== b.y) return a.y < b.y ? -1 : 1;
  if (a.m !== b.m) return a.m < b.m ? -1 : 1;
  if (a.d !== b.d) return a.d < b.d ? -1 : 1;
  return 0;
}

/** True when `dueYmd` is strictly before the local calendar day of `now` (default: this instant). */
export function isCalendarOverdueYmd(
  dueYmd: string | null | undefined,
  now = new Date(),
): boolean {
  const due = parseDueDateParts(dueYmd);
  if (!due) return false;
  const today = {
    y: now.getFullYear(),
    m: now.getMonth() + 1,
    d: now.getDate(),
  };
  return compareYmd(due, today) < 0;
}

export function todayLocalYmd(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Fixes AI-extracted `YYYY-MM-DD` when the model used an old training year (e.g. 2024)
 * for an upcoming month/day. Re-anchors the same month/day to the current or next
 * calendar year so the deadline is not already years in the past.
 *
 * Does not change dates that are already in the current calendar year or later.
 */
export function normalizeAiExtractedDueDateYmd(
  raw: string | null | undefined,
  now = new Date(),
): string | null {
  const p = parseDueDateParts(raw);
  if (!p) return null;

  const cy = now.getFullYear();
  const today = {
    y: cy,
    m: now.getMonth() + 1,
    d: now.getDate(),
  };
  const pad = (n: number) => String(n).padStart(2, '0');

  if (p.y >= cy) {
    return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
  }

  const calThisYear = new Date(cy, p.m - 1, p.d, 12, 0, 0, 0);
  if (
    calThisYear.getFullYear() !== cy ||
    calThisYear.getMonth() !== p.m - 1 ||
    calThisYear.getDate() !== p.d
  ) {
    return null;
  }

  const thisYearYmd = { y: cy, m: p.m, d: p.d };
  if (compareYmd(thisYearYmd, today) >= 0) {
    return `${cy}-${pad(p.m)}-${pad(p.d)}`;
  }

  const ny = cy + 1;
  const calNext = new Date(ny, p.m - 1, p.d, 12, 0, 0, 0);
  if (
    calNext.getFullYear() !== ny ||
    calNext.getMonth() !== p.m - 1 ||
    calNext.getDate() !== p.d
  ) {
    return null;
  }
  return `${ny}-${pad(p.m)}-${pad(p.d)}`;
}
