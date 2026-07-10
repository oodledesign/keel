import { TZDate } from '@date-fns/tz';

const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export function parseTimeParts(value: string): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const match = TIME_RE.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid time value: ${value}`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? '0');

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    throw new Error(`Invalid time value: ${value}`);
  }

  return { hours, minutes, seconds };
}

/** Build a UTC `Date` from a local civil date + wall clock in `timeZone`. */
export function zonedDateTimeToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  timeZone: string,
): Date {
  return new Date(
    new TZDate(
      year,
      monthIndex,
      day,
      hours,
      minutes,
      seconds,
      timeZone,
    ).getTime(),
  );
}

export function formatYmdInTimeZone(date: Date, timeZone: string): string {
  const zoned = new TZDate(date, timeZone);
  const y = zoned.getFullYear();
  const m = String(zoned.getMonth() + 1).padStart(2, '0');
  const d = String(zoned.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayOfWeekInTimeZone(date: Date, timeZone: string): number {
  return new TZDate(date, timeZone).getDay();
}

export function startOfDayInTimeZone(date: Date, timeZone: string): Date {
  const zoned = new TZDate(date, timeZone);
  return zonedDateTimeToUtc(
    zoned.getFullYear(),
    zoned.getMonth(),
    zoned.getDate(),
    0,
    0,
    0,
    timeZone,
  );
}

export function addCalendarDaysInTimeZone(
  date: Date,
  days: number,
  timeZone: string,
): Date {
  const zoned = new TZDate(date, timeZone);
  // TZDate arithmetic uses local calendar fields
  const next = new TZDate(
    zoned.getFullYear(),
    zoned.getMonth(),
    zoned.getDate() + days,
    0,
    0,
    0,
    timeZone,
  );
  return new Date(next.getTime());
}

export function parseYmd(ymd: string): {
  year: number;
  monthIndex: number;
  day: number;
} {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid date value: ${ymd}`);
  }
  return { year: y, monthIndex: m - 1, day: d };
}
