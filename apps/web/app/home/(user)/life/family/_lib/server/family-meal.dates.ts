export function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function addDays(ymd: string, days: number): string {
  const date = parseYmd(ymd);
  date.setDate(date.getDate() + days);
  return toYmd(date);
}

/** Monday of the week containing `from` (local time), as YYYY-MM-DD. */
export function mondayWeekStart(from = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const day = date.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toYmd(date);
}

/** The 7 dates (Mon→Sun) of the week starting at `weekStart`. */
export function weekDatesFrom(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function weekdayLabel(ymd: string): string {
  return WEEKDAY_LABELS[parseYmd(ymd).getDay()] ?? '';
}

export function weekdayShort(ymd: string): string {
  return weekdayLabel(ymd).slice(0, 3);
}

/** Current calendar month as YYYY-MM (local time). */
export function currentMonthKey(from = new Date()): string {
  const y = from.getFullYear();
  const m = String(from.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function monthKeyFromYmd(ymd: string): string {
  return ymd.slice(0, 7);
}

export function shiftMonth(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1 + deltaMonths, 1, 12, 0, 0, 0);
  return currentMonthKey(date);
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, 1, 12, 0, 0, 0).toLocaleDateString(
    'en-GB',
    { month: 'long', year: 'numeric' },
  );
}

/** Every date in a calendar month (YYYY-MM). */
export function monthDatesFrom(monthKey: string): string[] {
  const [y, m] = monthKey.split('-').map(Number);
  const lastDay = new Date(y ?? 1970, m ?? 1, 0, 12, 0, 0, 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    return `${monthKey}-${d}`;
  });
}

export type MonthCalendarCell = {
  date: string;
  inMonth: boolean;
};

/** Flat Mon-start grid cells for a month (includes leading/trailing padding days). */
export function monthCalendarGrid(monthKey: string): MonthCalendarCell[] {
  const monthStart = `${monthKey}-01`;
  const inMonthDates = monthDatesFrom(monthKey);
  const first = parseYmd(monthStart);
  const mondayOffset = (first.getDay() + 6) % 7;

  const cells: MonthCalendarCell[] = [];

  for (let i = mondayOffset; i > 0; i -= 1) {
    cells.push({ date: addDays(monthStart, -i), inMonth: false });
  }

  for (const date of inMonthDates) {
    cells.push({ date, inMonth: true });
  }

  let tail = 1;
  while (cells.length % 7 !== 0) {
    const lastDate = cells[cells.length - 1]?.date ?? monthStart;
    cells.push({ date: addDays(lastDate, 1), inMonth: false });
    tail += 1;
    if (tail > 14) break;
  }

  return cells;
}

export function mealPlanUrl(
  basePath: string,
  view: 'week' | 'month',
  weekStart: string,
  monthKey: string,
): string {
  if (view === 'month') {
    return `${basePath}?view=month&month=${monthKey}`;
  }
  return `${basePath}?view=week&week=${weekStart}`;
}

export function chunkDates(dates: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < dates.length; i += size) {
    chunks.push(dates.slice(i, i + size));
  }
  return chunks;
}
