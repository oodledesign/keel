import { describe, expect, it } from 'vitest';

import { computeAvailableSlots } from './compute-available-slots';
import type { EventTypeSlotSettings } from '../types';

const baseEventType: EventTypeSlotSettings = {
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minimumNoticeMinutes: 0,
  bookingWindowDays: 14,
  maxBookingsPerDay: null,
  slotIncrementMinutes: 30,
};

describe('computeAvailableSlots', () => {
  it('handles Europe/London spring-forward DST (2026-03-29)', () => {
    // Clocks jump 01:00 → 02:00 BST. A 09:00–12:00 local window must still
    // produce UTC starts that reflect GMT on Sat and BST on Sun.
    const now = new Date('2026-03-28T08:00:00.000Z'); // Saturday morning UTC

    const slots = computeAvailableSlots({
      eventType: { ...baseEventType, minimumNoticeMinutes: 0 },
      schedule: { timezone: 'Europe/London' },
      rules: [
        { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' }, // Saturday
        { dayOfWeek: 0, startTime: '09:00', endTime: '12:00' }, // Sunday (DST)
      ],
      overrides: [],
      busyIntervals: [],
      durationMinutes: 60,
      inviteeTimezone: 'Europe/London',
      now,
    });

    const saturday = slots.filter(
      (slot) => slot.start.toISOString().startsWith('2026-03-28'),
    );
    const sunday = slots.filter(
      (slot) => slot.start.toISOString().startsWith('2026-03-29'),
    );

    expect(saturday.length).toBeGreaterThan(0);
    expect(sunday.length).toBeGreaterThan(0);

    // 09:00 GMT = 09:00Z before the transition
    expect(saturday[0]!.start.toISOString()).toBe('2026-03-28T09:00:00.000Z');
    // 09:00 BST = 08:00Z after the transition
    expect(sunday[0]!.start.toISOString()).toBe('2026-03-29T08:00:00.000Z');
  });

  it('supports overnight rules that span midnight', () => {
    const now = new Date('2026-07-10T10:00:00.000Z'); // Friday

    const slots = computeAvailableSlots({
      eventType: {
        ...baseEventType,
        slotIncrementMinutes: 30,
        minimumNoticeMinutes: 0,
        bookingWindowDays: 2,
      },
      schedule: { timezone: 'Europe/London' },
      rules: [
        // Friday 22:00 → Saturday 02:00
        { dayOfWeek: 5, startTime: '22:00', endTime: '02:00' },
      ],
      overrides: [],
      busyIntervals: [],
      durationMinutes: 60,
      inviteeTimezone: 'Europe/London',
      now,
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]!.start.toISOString()).toBe('2026-07-10T21:00:00.000Z'); // 22:00 BST
    expect(slots.at(-1)!.end.toISOString()).toBe('2026-07-11T01:00:00.000Z'); // ends by 02:00 BST
  });

  it('applies buffers so busy neighbours collide with nearby slots', () => {
    const now = new Date('2026-07-13T07:00:00.000Z'); // Monday

    const withoutBuffers = computeAvailableSlots({
      eventType: { ...baseEventType, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
      schedule: { timezone: 'UTC' },
      rules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
      overrides: [],
      busyIntervals: [
        {
          start: new Date('2026-07-13T10:00:00.000Z'),
          end: new Date('2026-07-13T10:30:00.000Z'),
        },
      ],
      durationMinutes: 30,
      inviteeTimezone: 'UTC',
      now,
    });

    const withBuffers = computeAvailableSlots({
      eventType: {
        ...baseEventType,
        bufferBeforeMinutes: 15,
        bufferAfterMinutes: 15,
      },
      schedule: { timezone: 'UTC' },
      rules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
      overrides: [],
      busyIntervals: [
        {
          start: new Date('2026-07-13T10:00:00.000Z'),
          end: new Date('2026-07-13T10:30:00.000Z'),
        },
      ],
      durationMinutes: 30,
      inviteeTimezone: 'UTC',
      now,
    });

    const startsWithout = withoutBuffers.map((s) => s.start.toISOString());
    const startsWith = withBuffers.map((s) => s.start.toISOString());

    expect(startsWithout).toContain('2026-07-13T09:30:00.000Z');
    expect(startsWithout).toContain('2026-07-13T10:30:00.000Z');
    expect(startsWith).not.toContain('2026-07-13T09:30:00.000Z');
    expect(startsWith).not.toContain('2026-07-13T10:30:00.000Z');
  });

  it('enforces minimum notice at the boundary', () => {
    const now = new Date('2026-07-13T09:00:00.000Z');

    const slots = computeAvailableSlots({
      eventType: {
        ...baseEventType,
        minimumNoticeMinutes: 240, // 4 hours
        slotIncrementMinutes: 30,
      },
      schedule: { timezone: 'UTC' },
      rules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }],
      overrides: [],
      busyIntervals: [],
      durationMinutes: 30,
      inviteeTimezone: 'UTC',
      now,
    });

    // Exactly 4h later is allowed; earlier is not
    expect(slots[0]!.start.toISOString()).toBe('2026-07-13T13:00:00.000Z');
    expect(
      slots.every((slot) => slot.start.getTime() >= now.getTime() + 240 * 60_000),
    ).toBe(true);
  });

  it('blocks override dates when start and end are null', () => {
    const now = new Date('2026-07-13T07:00:00.000Z');

    const slots = computeAvailableSlots({
      eventType: baseEventType,
      schedule: { timezone: 'UTC' },
      rules: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '12:00' },
      ],
      overrides: [
        { date: '2026-07-13', startTime: null, endTime: null }, // Monday blocked
      ],
      busyIntervals: [],
      durationMinutes: 30,
      inviteeTimezone: 'UTC',
      now,
    });

    expect(
      slots.every((slot) => !slot.start.toISOString().startsWith('2026-07-13')),
    ).toBe(true);
    expect(
      slots.some((slot) => slot.start.toISOString().startsWith('2026-07-14')),
    ).toBe(true);
  });

  it('emits different slot sets for multi-duration event types', () => {
    const now = new Date('2026-07-13T07:00:00.000Z');
    const shared = {
      eventType: { ...baseEventType, bookingWindowDays: 1 },
      schedule: { timezone: 'UTC' as const },
      rules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '11:00' }],
      overrides: [],
      busyIntervals: [],
      inviteeTimezone: 'UTC',
      now,
    };

    const thirty = computeAvailableSlots({ ...shared, durationMinutes: 30 });
    const sixty = computeAvailableSlots({ ...shared, durationMinutes: 60 });

    expect(thirty.map((s) => s.start.toISOString())).toEqual([
      '2026-07-13T09:00:00.000Z',
      '2026-07-13T09:30:00.000Z',
      '2026-07-13T10:00:00.000Z',
      '2026-07-13T10:30:00.000Z',
    ]);
    expect(sixty.map((s) => s.start.toISOString())).toEqual([
      '2026-07-13T09:00:00.000Z',
      '2026-07-13T09:30:00.000Z',
      '2026-07-13T10:00:00.000Z',
    ]);
    expect(sixty.every((s) => s.end.getTime() - s.start.getTime() === 60 * 60_000)).toBe(
      true,
    );
  });

  it('enforces max bookings per day using existing bookings', () => {
    const now = new Date('2026-07-13T07:00:00.000Z');

    const slots = computeAvailableSlots({
      eventType: { ...baseEventType, maxBookingsPerDay: 1 },
      schedule: { timezone: 'UTC' },
      rules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
      overrides: [],
      busyIntervals: [],
      existingBookings: [
        {
          start: new Date('2026-07-13T09:00:00.000Z'),
          end: new Date('2026-07-13T09:30:00.000Z'),
          status: 'confirmed',
        },
      ],
      durationMinutes: 30,
      inviteeTimezone: 'UTC',
      now,
    });

    expect(slots.every((slot) => !slot.start.toISOString().startsWith('2026-07-13'))).toBe(
      true,
    );
  });
});
