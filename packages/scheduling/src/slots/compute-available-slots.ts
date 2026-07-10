import { TZDate } from '@date-fns/tz';

import type {
  AvailabilityOverrideInput,
  AvailabilityRuleInput,
  AvailabilityScheduleInput,
  AvailableSlot,
  BusyInterval,
  EventTypeSlotSettings,
  ExistingBookingInput,
} from '../types';
import {
  addCalendarDaysInTimeZone,
  dayOfWeekInTimeZone,
  formatYmdInTimeZone,
  parseTimeParts,
  parseYmd,
  startOfDayInTimeZone,
  zonedDateTimeToUtc,
} from '../timezone';

export type ComputeAvailableSlotsInput = {
  eventType: EventTypeSlotSettings;
  schedule: AvailabilityScheduleInput;
  rules: AvailabilityRuleInput[];
  overrides: AvailabilityOverrideInput[];
  busyIntervals: BusyInterval[];
  /** Confirmed bookings used for max-per-day and as additional busy time */
  existingBookings?: ExistingBookingInput[];
  durationMinutes: number;
  /**
   * Invitee IANA timezone. Slots are returned in UTC; this is accepted so
   * callers can pass the invitee's zone for future presentation without a
   * signature change.
   */
  inviteeTimezone: string;
  now: Date;
};

type UtcInterval = { start: number; end: number };

function toInterval(start: Date, end: Date): UtcInterval | null {
  const s = start.getTime();
  const e = end.getTime();
  if (!(e > s)) return null;
  return { start: s, end: e };
}

function mergeIntervals(intervals: UtcInterval[]): UtcInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: UtcInterval[] = [{ ...sorted[0]! }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function subtractBusy(
  free: UtcInterval[],
  busy: UtcInterval[],
): UtcInterval[] {
  let result = free;

  for (const block of busy) {
    const next: UtcInterval[] = [];
    for (const window of result) {
      if (block.end <= window.start || block.start >= window.end) {
        next.push(window);
        continue;
      }
      if (block.start > window.start) {
        next.push({ start: window.start, end: Math.min(block.start, window.end) });
      }
      if (block.end < window.end) {
        next.push({ start: Math.max(block.end, window.start), end: window.end });
      }
    }
    result = next.filter((w) => w.end > w.start);
  }

  return result;
}

function localWindowOnDate(
  ymd: string,
  startTime: string,
  endTime: string,
  timeZone: string,
): UtcInterval | null {
  const { year, monthIndex, day } = parseYmd(ymd);
  const startParts = parseTimeParts(startTime);
  const endParts = parseTimeParts(endTime);

  const start = zonedDateTimeToUtc(
    year,
    monthIndex,
    day,
    startParts.hours,
    startParts.minutes,
    startParts.seconds,
    timeZone,
  );

  const startSeconds =
    startParts.hours * 3600 + startParts.minutes * 60 + startParts.seconds;
  const endSeconds =
    endParts.hours * 3600 + endParts.minutes * 60 + endParts.seconds;
  const overnight = endSeconds <= startSeconds;

  const endBase = overnight
    ? addCalendarDaysInTimeZone(start, 1, timeZone)
    : start;
  const endYmd = formatYmdInTimeZone(endBase, timeZone);
  const endParsed = parseYmd(endYmd);

  const end = zonedDateTimeToUtc(
    endParsed.year,
    endParsed.monthIndex,
    endParsed.day,
    endParts.hours,
    endParts.minutes,
    endParts.seconds,
    timeZone,
  );

  return toInterval(start, end);
}

function windowsForDate(
  ymd: string,
  dayOfWeek: number,
  rules: AvailabilityRuleInput[],
  override: AvailabilityOverrideInput | undefined,
  timeZone: string,
): UtcInterval[] {
  if (override) {
    if (override.startTime === null && override.endTime === null) {
      return [];
    }
    if (override.startTime && override.endTime) {
      const window = localWindowOnDate(
        ymd,
        override.startTime,
        override.endTime,
        timeZone,
      );
      return window ? [window] : [];
    }
    return [];
  }

  const dayRules = rules.filter((rule) => rule.dayOfWeek === dayOfWeek);
  const windows: UtcInterval[] = [];

  for (const rule of dayRules) {
    const window = localWindowOnDate(
      ymd,
      rule.startTime,
      rule.endTime,
      timeZone,
    );
    if (window) windows.push(window);
  }

  return mergeIntervals(windows);
}

function expandBusyWithBuffers(
  intervals: BusyInterval[],
  bufferBeforeMinutes: number,
  bufferAfterMinutes: number,
): UtcInterval[] {
  const beforeMs = bufferBeforeMinutes * 60_000;
  const afterMs = bufferAfterMinutes * 60_000;

  return intervals
    .map((interval) =>
      toInterval(
        new Date(interval.start.getTime() - beforeMs),
        new Date(interval.end.getTime() + afterMs),
      ),
    )
    .filter((interval): interval is UtcInterval => Boolean(interval));
}

function alignSlotStart(
  cursorMs: number,
  timeZone: string,
  incrementMinutes: number,
): number {
  if (incrementMinutes <= 0) {
    return cursorMs;
  }

  const zoned = new TZDate(cursorMs, timeZone);
  const minutesOfDay = zoned.getHours() * 60 + zoned.getMinutes();
  const remainder = minutesOfDay % incrementMinutes;

  if (remainder === 0 && zoned.getSeconds() === 0 && zoned.getMilliseconds() === 0) {
    return cursorMs;
  }

  const add = remainder === 0 ? incrementMinutes : incrementMinutes - remainder;
  const alignedMinutes = minutesOfDay + add;
  const hours = Math.floor(alignedMinutes / 60);
  const minutes = alignedMinutes % 60;

  // May spill into the next calendar day when aligning near midnight
  const base = startOfDayInTimeZone(new Date(cursorMs), timeZone);
  const dayOffset = Math.floor(hours / 24);
  const localHours = hours % 24;
  const dayStart = addCalendarDaysInTimeZone(base, dayOffset, timeZone);
  const ymd = formatYmdInTimeZone(dayStart, timeZone);
  const { year, monthIndex, day } = parseYmd(ymd);

  return zonedDateTimeToUtc(
    year,
    monthIndex,
    day,
    localHours,
    minutes,
    0,
    timeZone,
  ).getTime();
}

/**
 * Pure availability engine. No I/O.
 *
 * Order of operations:
 * 1. Weekly rules in the schedule timezone
 * 2. Date overrides
 * 3. Subtract busy intervals (with buffers applied to busy)
 * 4. Enforce minimum notice
 * 5. Enforce booking window
 * 6. Enforce max bookings per day (schedule-local day)
 * 7. Emit slots at `slotIncrementMinutes`, returned in UTC
 */
export function computeAvailableSlots(
  input: ComputeAvailableSlotsInput,
): AvailableSlot[] {
  const {
    eventType,
    schedule,
    rules,
    overrides,
    busyIntervals,
    existingBookings = [],
    durationMinutes,
    now,
  } = input;

  void input.inviteeTimezone;

  if (durationMinutes <= 0) {
    return [];
  }

  const timeZone = schedule.timezone;
  const durationMs = durationMinutes * 60_000;
  const incrementMs = Math.max(1, eventType.slotIncrementMinutes) * 60_000;
  const minStart = now.getTime() + eventType.minimumNoticeMinutes * 60_000;
  const maxStart =
    now.getTime() + eventType.bookingWindowDays * 24 * 60 * 60 * 1000;

  const rangeStart = startOfDayInTimeZone(now, timeZone);
  const rangeEnd = addCalendarDaysInTimeZone(
    startOfDayInTimeZone(new Date(maxStart), timeZone),
    1,
    timeZone,
  );

  const overrideByDate = new Map(
    overrides.map((override) => [override.date, override] as const),
  );

  const confirmedBookings = existingBookings.filter(
    (booking) => !booking.status || booking.status === 'confirmed',
  );

  const bookingsByDay = new Map<string, number>();
  for (const booking of confirmedBookings) {
    const key = formatYmdInTimeZone(booking.start, timeZone);
    bookingsByDay.set(key, (bookingsByDay.get(key) ?? 0) + 1);
  }

  const busy = mergeIntervals([
    ...expandBusyWithBuffers(
      busyIntervals,
      eventType.bufferBeforeMinutes,
      eventType.bufferAfterMinutes,
    ),
    ...expandBusyWithBuffers(
      confirmedBookings.map((booking) => ({
        start: booking.start,
        end: booking.end,
      })),
      eventType.bufferBeforeMinutes,
      eventType.bufferAfterMinutes,
    ),
  ]);

  const freeWindows: UtcInterval[] = [];
  let cursorDay = rangeStart;

  while (cursorDay.getTime() < rangeEnd.getTime()) {
    const ymd = formatYmdInTimeZone(cursorDay, timeZone);
    const dow = dayOfWeekInTimeZone(cursorDay, timeZone);
    const dayWindows = windowsForDate(
      ymd,
      dow,
      rules,
      overrideByDate.get(ymd),
      timeZone,
    );
    freeWindows.push(...dayWindows);
    cursorDay = addCalendarDaysInTimeZone(cursorDay, 1, timeZone);
  }

  const open = subtractBusy(mergeIntervals(freeWindows), busy);
  const slots: AvailableSlot[] = [];
  const emittedStarts = new Set<number>();

  for (const window of open) {
    let slotStart = alignSlotStart(
      window.start,
      timeZone,
      eventType.slotIncrementMinutes,
    );

    if (slotStart < window.start) {
      slotStart += incrementMs;
    }

    while (slotStart + durationMs <= window.end) {
      if (slotStart >= minStart && slotStart <= maxStart) {
        const dayKey = formatYmdInTimeZone(new Date(slotStart), timeZone);
        const booked = bookingsByDay.get(dayKey) ?? 0;
        const underCap =
          eventType.maxBookingsPerDay === null ||
          booked < eventType.maxBookingsPerDay;

        if (underCap && !emittedStarts.has(slotStart)) {
          emittedStarts.add(slotStart);
          slots.push({
            start: new Date(slotStart),
            end: new Date(slotStart + durationMs),
          });
        }
      }

      slotStart += incrementMs;
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}
