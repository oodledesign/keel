import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type AccountTaskAutomationSettings = {
  accountId: string;
  meetingTasksMode: 'auto_publish' | 'requires_moderation';
  emailTasksMode: 'auto_publish' | 'requires_moderation';
  autoScheduleOnCalendar: boolean;
  calendarLeadTimeMinutes: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  excludePersonalCalendarBusy: boolean;
};

const DEFAULT_SETTINGS: Omit<AccountTaskAutomationSettings, 'accountId'> = {
  meetingTasksMode: 'requires_moderation',
  emailTasksMode: 'requires_moderation',
  autoScheduleOnCalendar: true,
  calendarLeadTimeMinutes: 30,
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  excludePersonalCalendarBusy: false,
};

function parseTimeToMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) {
    return 9 * 60;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function mapRow(
  accountId: string,
  row: {
    meeting_tasks_mode?: string | null;
    email_tasks_mode?: string | null;
    auto_schedule_on_calendar?: boolean | null;
    calendar_lead_time_minutes?: number | null;
    working_hours_start?: string | null;
    working_hours_end?: string | null;
    exclude_personal_calendar_busy?: boolean | null;
  } | null,
): AccountTaskAutomationSettings {
  return {
    accountId,
    meetingTasksMode:
      row?.meeting_tasks_mode === 'auto_publish'
        ? 'auto_publish'
        : 'requires_moderation',
    emailTasksMode:
      row?.email_tasks_mode === 'auto_publish'
        ? 'auto_publish'
        : 'requires_moderation',
    autoScheduleOnCalendar: row?.auto_schedule_on_calendar ?? DEFAULT_SETTINGS.autoScheduleOnCalendar,
    calendarLeadTimeMinutes:
      row?.calendar_lead_time_minutes ?? DEFAULT_SETTINGS.calendarLeadTimeMinutes,
    workingHoursStart:
      row?.working_hours_start?.slice(0, 5) ?? DEFAULT_SETTINGS.workingHoursStart,
    workingHoursEnd:
      row?.working_hours_end?.slice(0, 5) ?? DEFAULT_SETTINGS.workingHoursEnd,
    excludePersonalCalendarBusy:
      row?.exclude_personal_calendar_busy ?? DEFAULT_SETTINGS.excludePersonalCalendarBusy,
  };
}

export async function loadAccountTaskAutomationSettings(
  client: SupabaseClient,
  accountId: string,
): Promise<AccountTaskAutomationSettings> {
  const { data, error } = await client
    .from('account_task_automation_settings')
    .select(
      'meeting_tasks_mode, email_tasks_mode, auto_schedule_on_calendar, calendar_lead_time_minutes, working_hours_start, working_hours_end, exclude_personal_calendar_busy',
    )
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(accountId, data as Record<string, unknown> | null);
}

export async function upsertAccountTaskAutomationSettings(
  client: SupabaseClient,
  settings: AccountTaskAutomationSettings,
): Promise<AccountTaskAutomationSettings> {
  const { error } = await client.from('account_task_automation_settings').upsert(
    {
      account_id: settings.accountId,
      meeting_tasks_mode: settings.meetingTasksMode,
      email_tasks_mode: settings.emailTasksMode,
      auto_schedule_on_calendar: settings.autoScheduleOnCalendar,
      calendar_lead_time_minutes: settings.calendarLeadTimeMinutes,
      working_hours_start: settings.workingHoursStart,
      working_hours_end: settings.workingHoursEnd,
      exclude_personal_calendar_busy: settings.excludePersonalCalendarBusy,
    },
    { onConflict: 'account_id' },
  );

  if (error) {
    throw new Error(error.message);
  }

  return settings;
}

export type BusyInterval = { startMs: number; endMs: number };

export type FindFreeSlotInput = {
  nowMs?: number;
  dueDateYmd: string;
  leadTimeMinutes: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  slotDurationMinutes?: number;
  busyIntervals: BusyInterval[];
};

export type FreeSlotResult = {
  start: Date;
  end: Date;
} | null;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function withLocalTime(date: Date, minutesFromMidnight: number): Date {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0,
  );
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function findFreeSlotBeforeDueDate(
  input: FindFreeSlotInput,
): FreeSlotResult {
  const nowMs = input.nowMs ?? Date.now();
  const slotDurationMinutes = input.slotDurationMinutes ?? 30;
  const slotDurationMs = slotDurationMinutes * 60 * 1000;
  const leadTimeMs = input.leadTimeMinutes * 60 * 1000;
  const workStartMinutes = parseTimeToMinutes(input.workingHoursStart);
  const workEndMinutes = parseTimeToMinutes(input.workingHoursEnd);

  if (workEndMinutes <= workStartMinutes) {
    return null;
  }

  const dueParts = input.dueDateYmd.split('-').map(Number);
  if (dueParts.length !== 3 || dueParts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const dueDay = new Date(dueParts[0]!, dueParts[1]! - 1, dueParts[2]!, 23, 59, 59, 999);
  const latestEndMs = dueDay.getTime() - leadTimeMs;
  if (latestEndMs <= nowMs) {
    return null;
  }

  const dueIsWeekend = isWeekend(dueDay);
  const searchStartDay = startOfLocalDay(new Date(nowMs));
  const searchEndDay = startOfLocalDay(dueDay);

  for (
    let day = new Date(searchStartDay);
    day.getTime() <= searchEndDay.getTime();
    day.setDate(day.getDate() + 1)
  ) {
    const dayDate = new Date(day);
    if (isWeekend(dayDate) && !dueIsWeekend) {
      continue;
    }

    const dayWorkStart = withLocalTime(dayDate, workStartMinutes);
    const dayWorkEnd = withLocalTime(dayDate, workEndMinutes);
    let cursorStartMs = Math.max(dayWorkStart.getTime(), nowMs);

    while (cursorStartMs + slotDurationMs <= dayWorkEnd.getTime()) {
      const slotStartMs = cursorStartMs;
      const slotEndMs = cursorStartMs + slotDurationMs;

      if (slotEndMs > latestEndMs) {
        break;
      }

      const conflict = input.busyIntervals.some((interval) =>
        overlaps(slotStartMs, slotEndMs, interval.startMs, interval.endMs),
      );

      if (!conflict) {
        return {
          start: new Date(slotStartMs),
          end: new Date(slotEndMs),
        };
      }

      cursorStartMs += 15 * 60 * 1000;
    }
  }

  return null;
}

export function busyIntervalsFromIso(
  intervals: Array<{ start: string; end: string }>,
): BusyInterval[] {
  return intervals
    .map((interval) => ({
      startMs: Date.parse(interval.start),
      endMs: Date.parse(interval.end),
    }))
    .filter(
      (interval) =>
        !Number.isNaN(interval.startMs) && !Number.isNaN(interval.endMs),
    );
}

export { parseTimeToMinutes };
