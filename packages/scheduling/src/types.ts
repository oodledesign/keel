/** Inclusive UTC busy window from a calendar provider. */
export type BusyInterval = {
  start: Date;
  end: Date;
};

export type AvailabilityScheduleInput = {
  timezone: string;
};

export type AvailabilityRuleInput = {
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  /** Local wall time `HH:mm` or `HH:mm:ss` in the schedule timezone */
  startTime: string;
  endTime: string;
};

export type AvailabilityOverrideInput = {
  /** Calendar date `YYYY-MM-DD` in the schedule timezone */
  date: string;
  /** Both null = fully unavailable that date */
  startTime: string | null;
  endTime: string | null;
};

export type EventTypeSlotSettings = {
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  bookingWindowDays: number;
  maxBookingsPerDay: number | null;
  slotIncrementMinutes: number;
};

export type ExistingBookingInput = {
  start: Date;
  end: Date;
  /** Only `confirmed` counts toward max bookings / busy blocking */
  status?: 'confirmed' | 'cancelled' | 'rescheduled';
};

export type AvailableSlot = {
  /** UTC */
  start: Date;
  /** UTC */
  end: Date;
};

export type GoogleCalendarClient = {
  workspaceId: string;
  userId: string;
  accessToken: string;
  calendarId: string;
  busyCalendarIds: string[];
  personalCalendarIds: string[];
};
