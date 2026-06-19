import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  createTaskCalendarEvent,
  listBusyIntervalsForScheduling,
} from '~/lib/integrations/google-calendar/events';
import {
  busyIntervalsFromIso,
  findFreeSlotBeforeDueDate,
  loadAccountTaskAutomationSettings,
} from '~/lib/recorder/task-automation-settings';

export type SchedulePublishedTaskInput = {
  accountId: string;
  taskId: string;
  assigneeUserId: string;
  title: string;
  dueDate: string | null;
};

export type SchedulePublishedTaskResult =
  | { status: 'skipped'; reason: string }
  | { status: 'scheduled'; eventId: string; start: string; end: string }
  | { status: 'failed'; reason: string };

async function markTaskScheduleStatus(
  client: SupabaseClient,
  taskId: string,
  status: 'scheduled' | 'failed',
  eventId?: string | null,
) {
  const { error } = await client
    .from('tasks')
    .update({
      calendar_schedule_status: status,
      google_calendar_event_id: eventId ?? null,
    })
    .eq('id', taskId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function findFreeSlotBeforeDueDateForTask(
  admin: SupabaseClient,
  input: SchedulePublishedTaskInput,
): Promise<SchedulePublishedTaskResult> {
  if (!input.dueDate?.trim()) {
    return { status: 'skipped', reason: 'no_due_date' };
  }

  const settings = await loadAccountTaskAutomationSettings(admin, input.accountId);

  if (!settings.autoScheduleOnCalendar) {
    return { status: 'skipped', reason: 'auto_schedule_disabled' };
  }

  const now = new Date();
  const dueParts = input.dueDate.trim().split('-').map(Number);
  const dueDay = new Date(dueParts[0]!, dueParts[1]! - 1, dueParts[2]!);
  const searchStart = now.toISOString();
  const searchEnd = new Date(
    dueDay.getFullYear(),
    dueDay.getMonth(),
    dueDay.getDate(),
    23,
    59,
    59,
    999,
  ).toISOString();

  const busyIso = await listBusyIntervalsForScheduling(admin, {
    userId: input.assigneeUserId,
    timeMin: searchStart,
    timeMax: searchEnd,
    excludePersonalCalendarBusy: settings.excludePersonalCalendarBusy,
  });

  const slot = findFreeSlotBeforeDueDate({
    dueDateYmd: input.dueDate.trim(),
    leadTimeMinutes: settings.calendarLeadTimeMinutes,
    workingHoursStart: settings.workingHoursStart,
    workingHoursEnd: settings.workingHoursEnd,
    busyIntervals: busyIntervalsFromIso(busyIso),
  });

  if (!slot) {
    return { status: 'failed', reason: 'no_free_slot' };
  }

  return {
    status: 'scheduled',
    eventId: 'pending',
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
  };
}

export async function schedulePublishedTaskIfEnabled(
  client: SupabaseClient,
  input: SchedulePublishedTaskInput,
): Promise<SchedulePublishedTaskResult> {
  const admin = getSupabaseServerAdminClient();
  const preview = await findFreeSlotBeforeDueDateForTask(admin, input);

  if (preview.status === 'skipped') {
    return preview;
  }

  if (preview.status === 'failed') {
    await markTaskScheduleStatus(client, input.taskId, 'failed');
    return preview;
  }

  try {
    const eventId = await createTaskCalendarEvent(admin, {
      userId: input.assigneeUserId,
      title: input.title,
      start: preview.start,
      end: preview.end,
      description: `Planner task scheduled before due date ${input.dueDate}`,
    });

    await markTaskScheduleStatus(client, input.taskId, 'scheduled', eventId);

    return {
      status: 'scheduled',
      eventId,
      start: preview.start,
      end: preview.end,
    };
  } catch (error) {
    await markTaskScheduleStatus(client, input.taskId, 'failed');
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'calendar_create_failed',
    };
  }
}
