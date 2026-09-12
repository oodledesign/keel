import { UNDO_WINDOW_MS } from './constants';

export function isUndoWindowOpen(
  burnedAt: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!burnedAt) return false;
  const burned = burnedAt instanceof Date ? burnedAt : new Date(burnedAt);
  if (Number.isNaN(burned.getTime())) return false;
  return now.getTime() - burned.getTime() <= UNDO_WINDOW_MS;
}

export function undoWindowEndsAt(
  burnedAt: string | Date | null | undefined,
): Date | null {
  if (!burnedAt) return null;
  const burned = burnedAt instanceof Date ? burnedAt : new Date(burnedAt);
  if (Number.isNaN(burned.getTime())) return null;
  return new Date(burned.getTime() + UNDO_WINDOW_MS);
}

/** Monday (ISO week) of the London civil date, as YYYY-MM-DD. */
export function londonWeekStartYmd(
  now: Date,
  timeZone = 'Europe/London',
): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const year = Number(read('year'));
  const month = Number(read('month'));
  const day = Number(read('day'));
  const weekday = read('weekday');

  const weekdayOffset: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  const utcNoon = Date.UTC(year, month - 1, day, 12);
  const monday = new Date(
    utcNoon - (weekdayOffset[weekday] ?? 0) * 24 * 60 * 60 * 1000,
  );

  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function previousLondonWeekStartYmd(
  now: Date,
  timeZone = 'Europe/London',
): string {
  const thisMonday = londonWeekStartYmd(now, timeZone);
  const [year, month, day] = thisMonday.split('-').map(Number);
  const previous = new Date(Date.UTC(year!, month! - 1, day! - 7, 12));
  const y = previous.getUTCFullYear();
  const m = String(previous.getUTCMonth() + 1).padStart(2, '0');
  const d = String(previous.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function londonWeekRangeUtc(weekStartYmd: string): {
  startIso: string;
  endIso: string;
} {
  const [year, month, day] = weekStartYmd.split('-').map(Number);
  const start = new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0));
  // Approximate London midnight as UTC midnight for the civil Monday.
  // Digest matching uses created_at >= start and < start+7d.
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
