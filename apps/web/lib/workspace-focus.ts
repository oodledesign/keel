export type WorkspaceFocusOooTrigger =
  | 'manual'
  | 'outside_hours'
  | 'holiday_only'
  | 'outside_hours_or_holiday'
  | 'outside_hours_and_holiday'
  | 'always';

export type WorkspaceFocusInput = {
  account_id?: string;
  silence_outside_hours: boolean;
  work_days: number[];
  work_start_time: string;
  work_end_time: string;
  timezone: string;
  holiday_mode_enabled: boolean;
  holiday_mode_label: string;
  holiday_mode_until: string | null;
  ooo_enabled: boolean;
  ooo_trigger: WorkspaceFocusOooTrigger;
  ooo_message: string;
  ooo_holiday_message: string | null;
  ooo_sender_name: string | null;
  ooo_cc_email: string | null;
  ooo_include_return_date: boolean;
};

export type WorkspaceFocusState = {
  isWithinWorkHours: boolean;
  nextWorkStart: Date | null;
  nextWorkEnd: Date | null;
  isHolidayModeActive: boolean;
  isWorkspaceSilenced: boolean;
  isOOOActive: boolean;
  effectiveOOOMessage: string;
  currentStatusLabel: string;
  currentStatusVariant: 'active' | 'muted' | 'holiday' | 'ooo';
};

export const DEFAULT_WORKSPACE_FOCUS_STATE: WorkspaceFocusState = {
  isWithinWorkHours: true,
  nextWorkStart: null,
  nextWorkEnd: null,
  isHolidayModeActive: false,
  isWorkspaceSilenced: false,
  isOOOActive: false,
  effectiveOOOMessage: '',
  currentStatusLabel: 'Available',
  currentStatusVariant: 'active',
};

const WEEKDAY_TO_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

function parseTimeToMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const weekdayLabel = read('weekday');

  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour: Number(read('hour')),
    minute: Number(read('minute')),
    weekday: WEEKDAY_TO_NUMBER[weekdayLabel] ?? 0,
  };
}

function makeZonedDateTime(
  year: number,
  month: number,
  day: number,
  timeHHMM: string,
  timeZone: string,
): Date {
  const [hours = 0, minutes = 0] = timeHHMM.split(':').map(Number);
  const targetDayMinutes = hours * 60 + minutes;

  let lo = Date.UTC(year, month - 1, day, 0, 0, 0) - 36 * 60 * 60 * 1000;
  let hi = Date.UTC(year, month - 1, day, 23, 59, 59) + 36 * 60 * 60 * 1000;

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const mid = Math.floor((lo + hi) / 2);
    const probe = new Date(mid);
    const parts = getZonedParts(probe, timeZone);
    const probeDayMinutes = parts.hour * 60 + parts.minute;
    const sameDay =
      parts.year === year && parts.month === month && parts.day === day;

    if (sameDay && probeDayMinutes === targetDayMinutes) {
      return probe;
    }

    const dayKey = parts.year * 10_000 + parts.month * 100 + parts.day;
    const targetKey = year * 10_000 + month * 100 + day;

    if (dayKey < targetKey || (sameDay && probeDayMinutes < targetDayMinutes)) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
}

function getYmdForOffset(
  base: Date,
  dayOffset: number,
  timeZone: string,
): Pick<ZonedParts, 'year' | 'month' | 'day' | 'weekday'> {
  const probe = new Date(base.getTime() + dayOffset * 86_400_000);
  const parts = getZonedParts(probe, timeZone);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    weekday: parts.weekday,
  };
}

export function isWithinWorkHoursAt(
  settings: WorkspaceFocusInput,
  at: Date,
): boolean {
  if (settings.work_start_time === settings.work_end_time) {
    return false;
  }

  const parts = getZonedParts(at, settings.timezone);

  if (!settings.work_days.includes(parts.weekday)) {
    return false;
  }

  const currentMinutes = parts.hour * 60 + parts.minute;
  const startMinutes = parseTimeToMinutes(settings.work_start_time);
  const endMinutes = parseTimeToMinutes(settings.work_end_time);

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export function findNextWorkStart(
  settings: WorkspaceFocusInput,
  from: Date,
): Date | null {
  if (settings.work_start_time === settings.work_end_time) {
    return null;
  }

  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const { year, month, day, weekday } = getYmdForOffset(
      from,
      dayOffset,
      settings.timezone,
    );

    if (!settings.work_days.includes(weekday)) {
      continue;
    }

    const start = makeZonedDateTime(
      year,
      month,
      day,
      settings.work_start_time,
      settings.timezone,
    );

    if (start > from) {
      return start;
    }
  }

  return null;
}

export function findNextWorkEnd(
  settings: WorkspaceFocusInput,
  from: Date,
): Date | null {
  if (settings.work_start_time === settings.work_end_time) {
    return null;
  }

  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const { year, month, day, weekday } = getYmdForOffset(
      from,
      dayOffset,
      settings.timezone,
    );

    if (!settings.work_days.includes(weekday)) {
      continue;
    }

    const end = makeZonedDateTime(
      year,
      month,
      day,
      settings.work_end_time,
      settings.timezone,
    );

    if (end > from) {
      return end;
    }
  }

  return null;
}

export function computeHolidayModeActive(
  settings: WorkspaceFocusInput,
  now: Date,
  holidayClearedLocally = false,
): boolean {
  if (holidayClearedLocally) {
    return false;
  }

  if (!settings.holiday_mode_enabled) {
    return false;
  }

  if (!settings.holiday_mode_until) {
    return true;
  }

  return new Date(settings.holiday_mode_until) > now;
}

export function computeOOOActive(
  settings: WorkspaceFocusInput,
  isWithinWorkHours: boolean,
  isHolidayModeActive: boolean,
): boolean {
  if (!settings.ooo_enabled) {
    return false;
  }

  switch (settings.ooo_trigger) {
    case 'manual':
      return true;
    case 'outside_hours':
      return !isWithinWorkHours;
    case 'holiday_only':
      return isHolidayModeActive;
    case 'outside_hours_or_holiday':
      return !isWithinWorkHours || isHolidayModeActive;
    case 'outside_hours_and_holiday':
      return !isWithinWorkHours && isHolidayModeActive;
    case 'always':
      return true;
    default:
      return false;
  }
}

export function formatHolidayReturnDate(until: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(until));
}

export function computeEffectiveOOOMessage(
  settings: WorkspaceFocusInput,
  isHolidayModeActive: boolean,
): string {
  let base = settings.ooo_message;

  if (
    isHolidayModeActive &&
    settings.ooo_holiday_message &&
    settings.ooo_holiday_message.length > 0
  ) {
    base = settings.ooo_holiday_message;
  }

  if (settings.ooo_include_return_date && settings.holiday_mode_until) {
    const returnDate = formatHolidayReturnDate(settings.holiday_mode_until);
    base += `\n\nI'll be back on ${returnDate}.`;
  }

  return base.trim();
}

function computeStatus(
  settings: WorkspaceFocusInput,
  isWithinWorkHours: boolean,
  isHolidayModeActive: boolean,
  isOOOActive: boolean,
): Pick<WorkspaceFocusState, 'currentStatusLabel' | 'currentStatusVariant'> {
  if (isHolidayModeActive) {
    const formattedDate = settings.holiday_mode_until
      ? formatHolidayReturnDate(settings.holiday_mode_until)
      : null;

    return {
      currentStatusLabel: formattedDate
        ? `${settings.holiday_mode_label} — back ${formattedDate}`
        : settings.holiday_mode_label,
      currentStatusVariant: 'holiday',
    };
  }

  if (!isWithinWorkHours && settings.silence_outside_hours) {
    return {
      currentStatusLabel: 'Outside hours',
      currentStatusVariant: 'muted',
    };
  }

  if (isOOOActive) {
    return {
      currentStatusLabel: 'OOO replies on',
      currentStatusVariant: 'ooo',
    };
  }

  return {
    currentStatusLabel: 'Available',
    currentStatusVariant: 'active',
  };
}

export type WorkspaceSchedulingSettings = Pick<
  WorkspaceFocusInput,
  'work_days' | 'work_start_time' | 'work_end_time' | 'timezone'
>;

export const DEFAULT_WORKSPACE_SCHEDULING: WorkspaceSchedulingSettings = {
  work_days: [1, 2, 3, 4, 5],
  work_start_time: '09:00',
  work_end_time: '17:30',
  timezone: 'Europe/London',
};

export function resolveWorkspaceSchedulingSettings(
  settings: WorkspaceFocusInput | null | undefined,
): WorkspaceSchedulingSettings {
  if (!settings) {
    return DEFAULT_WORKSPACE_SCHEDULING;
  }

  return {
    work_days:
      settings.work_days.length > 0
        ? settings.work_days
        : DEFAULT_WORKSPACE_SCHEDULING.work_days,
    work_start_time:
      settings.work_start_time || DEFAULT_WORKSPACE_SCHEDULING.work_start_time,
    work_end_time:
      settings.work_end_time || DEFAULT_WORKSPACE_SCHEDULING.work_end_time,
    timezone: settings.timezone || DEFAULT_WORKSPACE_SCHEDULING.timezone,
  };
}

export function ymdFromMs(ms: number, timezone: string): string {
  const parts = getZonedParts(new Date(ms), timezone);
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

export function addDaysToYmd(ymd: string, days: number): string {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return ymd;
  }

  const date = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

export function getWeekdayForYmd(ymd: string, timezone: string): number | null {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const probe = makeZonedDateTime(
    parts[0]!,
    parts[1]!,
    parts[2]!,
    '12:00',
    timezone,
  );

  return getZonedParts(probe, timezone).weekday;
}

export function isWorkingDayYmd(
  ymd: string,
  settings: WorkspaceSchedulingSettings,
): boolean {
  const weekday = getWeekdayForYmd(ymd, settings.timezone);
  if (weekday === null) {
    return false;
  }

  return settings.work_days.includes(weekday);
}

export function getWorkWindowForYmd(
  ymd: string,
  settings: WorkspaceSchedulingSettings,
): { startMs: number; endMs: number } | null {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const start = makeZonedDateTime(
    parts[0]!,
    parts[1]!,
    parts[2]!,
    settings.work_start_time,
    settings.timezone,
  );
  const end = makeZonedDateTime(
    parts[0]!,
    parts[1]!,
    parts[2]!,
    settings.work_end_time,
    settings.timezone,
  );

  return { startMs: start.getTime(), endMs: end.getTime() };
}

export function iterateYmdRange(fromYmd: string, toYmd: string): string[] {
  if (compareYmd(fromYmd, toYmd) > 0) {
    return [];
  }

  const days: string[] = [];
  let current = fromYmd;

  while (compareYmd(current, toYmd) <= 0) {
    days.push(current);
    current = addDaysToYmd(current, 1);
    if (days.length > 366) {
      break;
    }
  }

  return days;
}

export function snapDueDateYmd(
  ymd: string,
  settings: WorkspaceSchedulingSettings,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return ymd;
  }

  if (isWorkingDayYmd(ymd, settings)) {
    return ymd;
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDaysToYmd(ymd, -offset);
    if (isWorkingDayYmd(candidate, settings)) {
      return candidate;
    }
  }

  return ymd;
}

export function snapStartDateYmd(
  ymd: string,
  settings: WorkspaceSchedulingSettings,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return ymd;
  }

  if (isWorkingDayYmd(ymd, settings)) {
    return ymd;
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDaysToYmd(ymd, offset);
    if (isWorkingDayYmd(candidate, settings)) {
      return candidate;
    }
  }

  return ymd;
}

export function adjustPhasePlanDates<
  T extends {
    start_date?: string | null;
    due_date?: string | null;
    tasks?: Array<{ due_date?: string | null }>;
  },
>(phases: T[], settings: WorkspaceSchedulingSettings): T[] {
  return phases.map((phase) => ({
    ...phase,
    start_date: phase.start_date
      ? snapStartDateYmd(phase.start_date, settings)
      : phase.start_date,
    due_date: phase.due_date
      ? snapDueDateYmd(phase.due_date, settings)
      : phase.due_date,
    tasks: phase.tasks?.map((task) => ({
      ...task,
      due_date: task.due_date
        ? snapDueDateYmd(task.due_date, settings)
        : task.due_date,
    })),
  }));
}

export function computeWorkspaceFocusState(
  settings: WorkspaceFocusInput | null,
  now: Date,
  options?: {
    holidayClearedLocally?: boolean;
    nextWorkStart?: Date | null;
  },
): WorkspaceFocusState {
  if (!settings) {
    return DEFAULT_WORKSPACE_FOCUS_STATE;
  }

  const isWithinWorkHours = isWithinWorkHoursAt(settings, now);
  const isHolidayModeActive = computeHolidayModeActive(
    settings,
    now,
    options?.holidayClearedLocally ?? false,
  );
  const isWorkspaceSilenced =
    settings.silence_outside_hours && !isWithinWorkHours;
  const isOOOActive = computeOOOActive(
    settings,
    isWithinWorkHours,
    isHolidayModeActive,
  );
  const effectiveOOOMessage = computeEffectiveOOOMessage(
    settings,
    isHolidayModeActive,
  );
  const { currentStatusLabel, currentStatusVariant } = computeStatus(
    settings,
    isWithinWorkHours,
    isHolidayModeActive,
    isOOOActive,
  );

  return {
    isWithinWorkHours,
    nextWorkStart: options?.nextWorkStart ?? findNextWorkStart(settings, now),
    nextWorkEnd: findNextWorkEnd(settings, now),
    isHolidayModeActive,
    isWorkspaceSilenced,
    isOOOActive,
    effectiveOOOMessage,
    currentStatusLabel,
    currentStatusVariant,
  };
}
