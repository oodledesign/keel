import { parseYmd, zonedDateTimeToUtc } from '@kit/scheduling';

/**
 * Convert a civil date + wall-clock time in `timeZone` to a UTC ISO string.
 */
export function localDateTimeInTimezoneToUtcIso(
  localDate: string,
  localTime: string,
  timeZone: string,
): string {
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(localTime.trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate.trim()) || !timeMatch) {
    throw new Error('Invalid date or time');
  }

  const { year, monthIndex, day } = parseYmd(localDate.trim());
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error('Invalid date or time');
  }

  return zonedDateTimeToUtc(
    year,
    monthIndex,
    day,
    hours,
    minutes,
    0,
    timeZone,
  ).toISOString();
}

export function formatUtcInTimezone(
  iso: string,
  timeZone: string,
): { date: string; time: string; label: string } {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const y = read('year');
  const m = read('month');
  const d = read('day');
  const h = read('hour');
  const min = read('minute');
  const dateStr = `${y}-${m}-${d}`;
  const timeStr = `${h}:${min}`;
  return {
    date: dateStr,
    time: timeStr,
    label: `${d}/${m}/${y} ${h}:${min} (${timeZone})`,
  };
}
