import { computeAvailableSlots } from '../slots/compute-available-slots';
import {
  addCalendarDaysInTimeZone,
  formatYmdInTimeZone,
  parseTimeParts,
  parseYmd,
  zonedDateTimeToUtc,
} from '../timezone';
import type {
  AvailabilityOverrideInput,
  AvailabilityRuleInput,
  AvailableSlot,
  BusyInterval,
} from '../types';

/** Mon–Fri 09:00–17:00 when the workspace has no availability schedule. */
export const WEEKDAY_WORKING_HOURS: AvailabilityRuleInput[] = [
  1, 2, 3, 4, 5,
].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: '09:00',
  endTime: '17:00',
}));

export type SuggestPollSlotsInput = {
  timezone: string;
  rules: AvailabilityRuleInput[];
  overrides?: AvailabilityOverrideInput[];
  busyIntervals: BusyInterval[];
  durationMinutes: number;
  /** Inclusive civil dates `YYYY-MM-DD` in `timezone`. */
  rangeStartYmd: string;
  rangeEndYmd: string;
  now: Date;
  slotIncrementMinutes?: number;
  /** How many starts to keep on each local day. */
  maxPerDay?: number;
  /** Cap after spreading across days. */
  maxSlots?: number;
  minimumNoticeMinutes?: number;
};

/**
 * Candidate meeting times inside working hours, with busy time removed.
 * Returns a short Doodle-style list (spread across days), not every increment.
 */
export function suggestPollSlots(
  input: SuggestPollSlotsInput,
): AvailableSlot[] {
  const maxSlots = input.maxSlots ?? 12;
  const maxPerDay = input.maxPerDay ?? 2;
  const durationMinutes = input.durationMinutes;

  if (durationMinutes <= 0 || maxSlots <= 0 || input.rules.length === 0) {
    return [];
  }

  if (input.rangeEndYmd < input.rangeStartYmd) {
    return [];
  }

  const rangeEndExclusive = addCalendarDaysInTimeZone(
    startOfYmd(input.rangeEndYmd, input.timezone),
    1,
    input.timezone,
  );

  if (rangeEndExclusive.getTime() <= input.now.getTime()) {
    return [];
  }

  const windowMs = rangeEndExclusive.getTime() - input.now.getTime();
  const bookingWindowDays = Math.min(
    366,
    Math.max(1, Math.ceil(windowMs / 86_400_000) + 1),
  );

  const slots = computeAvailableSlots({
    eventType: {
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      minimumNoticeMinutes: input.minimumNoticeMinutes ?? 0,
      bookingWindowDays,
      maxBookingsPerDay: null,
      slotIncrementMinutes: input.slotIncrementMinutes ?? 30,
    },
    schedule: { timezone: input.timezone },
    rules: input.rules,
    overrides: input.overrides ?? [],
    busyIntervals: input.busyIntervals,
    durationMinutes,
    inviteeTimezone: input.timezone,
    now: input.now,
  });

  const inRange = slots.filter((slot) => {
    const ymd = formatYmdInTimeZone(slot.start, input.timezone);
    return ymd >= input.rangeStartYmd && ymd <= input.rangeEndYmd;
  });

  return thinSlots(inRange, input.timezone, maxPerDay, maxSlots);
}

/** Wall-clock start in `timezone`, lasting `durationMinutes`. */
export function localPollSlot(input: {
  timezone: string;
  dateYmd: string;
  timeHm: string;
  durationMinutes: number;
}): { start: Date; end: Date } {
  const { year, monthIndex, day } = parseYmd(input.dateYmd);
  const time = parseTimeParts(input.timeHm);
  const start = zonedDateTimeToUtc(
    year,
    monthIndex,
    day,
    time.hours,
    time.minutes,
    0,
    input.timezone,
  );
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);

  return { start, end };
}

function startOfYmd(ymd: string, timeZone: string): Date {
  const { year, monthIndex, day } = parseYmd(ymd);
  return zonedDateTimeToUtc(year, monthIndex, day, 0, 0, 0, timeZone);
}

function thinSlots(
  slots: AvailableSlot[],
  timeZone: string,
  maxPerDay: number,
  maxSlots: number,
): AvailableSlot[] {
  const byDay = new Map<string, AvailableSlot[]>();

  for (const slot of slots) {
    const key = formatYmdInTimeZone(slot.start, timeZone);
    const list = byDay.get(key) ?? [];
    list.push(slot);
    byDay.set(key, list);
  }

  const picked: AvailableSlot[] = [];

  for (const day of [...byDay.keys()].sort()) {
    const daySlots = byDay.get(day) ?? [];
    for (const slot of pickSpread(daySlots, Math.max(1, maxPerDay))) {
      if (picked.length >= maxSlots) {
        return picked;
      }
      picked.push(slot);
    }
  }

  return picked;
}

function pickSpread<T>(items: T[], count: number): T[] {
  if (items.length <= count) {
    return items;
  }

  if (count <= 1) {
    return [items[Math.floor((items.length - 1) / 2)]!];
  }

  const seen = new Set<number>();
  const picked: T[] = [];

  for (let index = 0; index < count; index += 1) {
    const itemIndex = Math.round((index * (items.length - 1)) / (count - 1));
    if (seen.has(itemIndex)) continue;
    seen.add(itemIndex);
    picked.push(items[itemIndex]!);
  }

  return picked;
}
