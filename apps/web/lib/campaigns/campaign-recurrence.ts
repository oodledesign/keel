/**
 * Recurring campaign occurrence planner.
 *
 * v1 UI is weekly (ISO weekday + time in a timezone). Monthly is implemented
 * here so a later release can expose `recurrence_freq = monthly` +
 * `recurrence_by_monthday` without changing the series table.
 */
import {
  parseCampaignTimezone,
  zonedLocalToUtcIso,
} from '~/lib/campaigns/campaign-timezone';

export const SERIES_WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
] as const;

export type SeriesRecurrenceFreq = 'weekly' | 'monthly';

export type SeriesOccurrence = {
  /** Calendar date of the send in the series timezone (YYYY-MM-DD). */
  occurrenceKey: string;
  scheduledAt: string;
};

export type SeriesRecurrenceInput = {
  freq: SeriesRecurrenceFreq;
  interval?: number;
  weekday: number | null;
  monthday: number | null;
  hour: number;
  minute: number;
  timezone: string;
  startsOn: string;
  endsOn?: string | null;
};

export type PlanSeriesInstancesInput = SeriesRecurrenceInput & {
  generateAhead: number;
  existing: Array<{
    occurrenceKey: string;
    scheduledAt: string | null;
    status: string;
  }>;
  now?: Date;
};

const CLOSED_INSTANCE_STATUSES = new Set(['cancelled', 'sent', 'failed']);

export function weekdayLabel(weekday: number | null | undefined): string {
  return (
    SERIES_WEEKDAYS.find((day) => day.value === weekday)?.label ?? 'Weekly'
  );
}

export function seriesRecurrenceSummary(input: {
  recurrenceFreq: SeriesRecurrenceFreq;
  recurrenceInterval: number;
  recurrenceByWeekday: number | null;
  recurrenceByMonthday: number | null;
  sendHour: number;
  sendMinute: number;
}): string {
  const time = formatSeriesTime(input.sendHour, input.sendMinute);
  if (input.recurrenceFreq === 'monthly') {
    return `Monthly on day ${input.recurrenceByMonthday ?? 1} at ${time}`;
  }
  const cadence =
    input.recurrenceInterval > 1
      ? `Every ${input.recurrenceInterval} weeks`
      : 'Weekly';
  return `${cadence} on ${weekdayLabel(input.recurrenceByWeekday)} at ${time}`;
}

export function padTimePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatSeriesTime(hour: number, minute: number): string {
  return `${padTimePart(hour)}:${padTimePart(minute)}`;
}

function parseYmd(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error('Invalid series date');
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function addCalendarDays(ymd: string, days: number): string {
  const { year, month, day } = parseYmd(ymd);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function addCalendarMonths(ymd: string, months: number): string {
  const { year, month, day } = parseYmd(ymd);
  const utc = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(
    Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const clamped = Math.min(day, last);
  utc.setUTCDate(clamped);
  return utc.toISOString().slice(0, 10);
}

export function zonedTodayYmd(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: parseCampaignTimezone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function isoWeekdayInZone(ymd: string, timeZone: string): number {
  const iso = zonedLocalToUtcIso(`${ymd}T12:00`, timeZone);
  const label = new Intl.DateTimeFormat('en-GB', {
    timeZone: parseCampaignTimezone(timeZone),
    weekday: 'short',
  }).format(new Date(iso));
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[label] ?? 1;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthlyKeyFor(year: number, month: number, monthday: number): string {
  const day = Math.min(Math.max(1, monthday), lastDayOfMonth(year, month));
  return `${year}-${padTimePart(month)}-${padTimePart(day)}`;
}

export function occurrenceScheduledAt(
  occurrenceKey: string,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  return zonedLocalToUtcIso(
    `${occurrenceKey}T${padTimePart(hour)}:${padTimePart(minute)}`,
    timeZone,
  );
}

function nextWeeklyKey(input: {
  fromYmd: string;
  weekday: number;
  interval: number;
  timezone: string;
}): string {
  const currentWeekday = isoWeekdayInZone(input.fromYmd, input.timezone);
  const delta = (input.weekday - currentWeekday + 7) % 7;
  return addCalendarDays(input.fromYmd, delta);
}

function* iterateOccurrences(
  input: SeriesRecurrenceInput,
): Generator<SeriesOccurrence> {
  const timezone = parseCampaignTimezone(input.timezone);
  const interval = Math.max(1, Math.min(52, input.interval ?? 1));
  const hour = Math.max(0, Math.min(23, input.hour));
  const minute = Math.max(0, Math.min(59, input.minute));
  const endsOn = input.endsOn?.trim() || null;

  if (input.freq === 'monthly') {
    const monthday = input.monthday ?? 1;
    let cursor = parseYmd(input.startsOn);
    let first = monthlyKeyFor(cursor.year, cursor.month, monthday);
    if (first < input.startsOn) {
      const next = addCalendarMonths(
        `${cursor.year}-${padTimePart(cursor.month)}-01`,
        1,
      );
      cursor = parseYmd(next);
      first = monthlyKeyFor(cursor.year, cursor.month, monthday);
    }

    let key = first;
    while (!endsOn || key <= endsOn) {
      yield {
        occurrenceKey: key,
        scheduledAt: occurrenceScheduledAt(key, hour, minute, timezone),
      };
      const nextMonth = addCalendarMonths(`${key.slice(0, 8)}01`, interval);
      const parsed = parseYmd(nextMonth);
      key = monthlyKeyFor(parsed.year, parsed.month, monthday);
    }
    return;
  }

  const weekday = input.weekday ?? 5;
  let key = nextWeeklyKey({
    fromYmd: input.startsOn,
    weekday,
    interval,
    timezone,
  });

  while (!endsOn || key <= endsOn) {
    yield {
      occurrenceKey: key,
      scheduledAt: occurrenceScheduledAt(key, hour, minute, timezone),
    };
    key = addCalendarDays(key, 7 * interval);
  }
}

export function isOpenUpcomingInstance(input: {
  scheduledAt: string | null;
  status: string;
  now: Date;
}): boolean {
  if (CLOSED_INSTANCE_STATUSES.has(input.status)) return false;
  if (!input.scheduledAt) return false;
  return new Date(input.scheduledAt).getTime() >= input.now.getTime();
}

/**
 * Next occurrences to materialise as draft campaigns so the planner stays
 * filled up to `generateAhead` upcoming open instances.
 */
export function planSeriesInstanceGeneration(
  input: PlanSeriesInstancesInput,
): SeriesOccurrence[] {
  const now = input.now ?? new Date();
  const generateAhead = Math.max(1, Math.min(12, input.generateAhead));
  const existingKeys = new Set(
    input.existing
      .map((row) => row.occurrenceKey)
      .filter((key) => Boolean(key)),
  );
  const upcomingOpen = input.existing.filter((row) =>
    isOpenUpcomingInstance({
      scheduledAt: row.scheduledAt,
      status: row.status,
      now,
    }),
  ).length;

  const needed = generateAhead - upcomingOpen;
  if (needed <= 0) return [];

  const planned: SeriesOccurrence[] = [];
  for (const occurrence of iterateOccurrences(input)) {
    if (new Date(occurrence.scheduledAt).getTime() < now.getTime()) {
      continue;
    }
    if (existingKeys.has(occurrence.occurrenceKey)) {
      continue;
    }
    planned.push(occurrence);
    if (planned.length >= needed) break;
  }

  return planned;
}

export function formatOccurrenceLabel(
  occurrenceKey: string,
  timeZone: string,
): string {
  try {
    const iso = zonedLocalToUtcIso(`${occurrenceKey}T12:00`, timeZone);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: parseCampaignTimezone(timeZone),
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return occurrenceKey;
  }
}
