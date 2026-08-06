import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTaskForUser } from '@kit/tasks/create-task';

import type { Database } from '~/lib/database.types';
import { addDaysYmd, clampDueDays } from '~/lib/invoices/invoice-due-date';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export type TaskRecurrenceFrequency =
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export type TaskRecurringSeriesRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  title: string;
  priority: string;
  notes: string | null;
  project_id: string | null;
  client_id: string | null;
  area_id: string | null;
  frequency: TaskRecurrenceFrequency;
  day_of_month: number | null;
  next_create_at: string;
  due_days: number;
  end_at: string | null;
  max_occurrences: number | null;
  occurrences_created: number;
  status: 'active' | 'paused' | 'ended';
};

function seriesTable(client: SupabaseClient<Database>) {
  return client.from('task_recurring_series');
}

/** Advance a create date by frequency, preserving day-of-month when set. */
export function addTaskRecurrenceFrequency(
  date: Date,
  frequency: TaskRecurrenceFrequency,
  dayOfMonth?: number | null,
): Date {
  const next = new Date(date.getTime());
  const anchorDay = dayOfMonth ?? next.getUTCDate();

  switch (frequency) {
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'fortnightly':
      next.setUTCDate(next.getUTCDate() + 14);
      break;
    case 'monthly':
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + 1);
      setDayOfMonthClamped(next, anchorDay);
      break;
    case 'quarterly':
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + 3);
      setDayOfMonthClamped(next, anchorDay);
      break;
    case 'yearly':
      next.setUTCDate(1);
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      setDayOfMonthClamped(next, anchorDay);
      break;
  }

  return next;
}

function setDayOfMonthClamped(date: Date, dayOfMonth: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(Math.max(1, dayOfMonth), lastDay));
}

function toDateOnlyIso(input: string | Date): string {
  if (input instanceof Date) {
    return input.toISOString().slice(0, 10);
  }
  return input.slice(0, 10);
}

function noonUtcFromYmd(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T12:00:00.000Z`);
}

export type CreateTaskRecurringSeriesInput = {
  title: string;
  priority?: string;
  notes?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  areaId?: string | null;
  accountId?: string | null;
  frequency: TaskRecurrenceFrequency;
  /** YYYY-MM-DD — first (or next) create date */
  firstCreateDate: string;
  dayOfMonth?: number | null;
  dueDays?: number;
  endAt?: string | null;
  maxOccurrences?: number | null;
  /** Create the first task now when firstCreateDate is today or past. Default true. */
  createFirstNow?: boolean;
};

export async function createTaskRecurringSeries(
  input: CreateTaskRecurringSeriesInput,
): Promise<{ seriesId: string; taskId: string | null }> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const title = input.title.trim();
  if (!title) {
    throw new Error('Title is required');
  }

  const dueDays = clampDueDays(input.dueDays, 0);
  const firstYmd = toDateOnlyIso(input.firstCreateDate);
  const firstDate = noonUtcFromYmd(firstYmd);

  const needsDayOfMonth =
    input.frequency === 'monthly' ||
    input.frequency === 'quarterly' ||
    input.frequency === 'yearly';

  const dayOfMonth = needsDayOfMonth
    ? Math.min(31, Math.max(1, input.dayOfMonth ?? firstDate.getUTCDate()))
    : null;

  if (dayOfMonth != null) {
    setDayOfMonthClamped(firstDate, dayOfMonth);
  }

  const todayYmd = new Date().toISOString().slice(0, 10);
  const createFirstNow =
    (input.createFirstNow ?? true) && toDateOnlyIso(firstDate) <= todayYmd;

  const payload = {
    user_id: user.id,
    account_id: input.accountId ?? null,
    title,
    priority: input.priority ?? 'medium',
    notes: input.notes?.trim() || null,
    project_id: input.projectId ?? null,
    client_id: input.clientId ?? null,
    area_id: input.areaId ?? null,
    frequency: input.frequency,
    day_of_month: dayOfMonth,
    next_create_at: firstDate.toISOString(),
    due_days: dueDays,
    end_at: input.endAt ?? null,
    max_occurrences: input.maxOccurrences ?? null,
    occurrences_created: 0,
    status: 'active' as const,
  };

  const { data: series, error } = await seriesTable(client)
    .insert(payload)
    .select('id')
    .single();

  if (error || !series) {
    throw new Error(error?.message ?? 'Could not create recurring series');
  }

  const seriesId = series.id;
  let taskId: string | null = null;

  if (createFirstNow) {
    const spawned = await spawnTaskFromSeries(client, {
      id: seriesId,
      user_id: user.id,
      account_id: input.accountId ?? null,
      title,
      priority: input.priority ?? 'medium',
      notes: input.notes?.trim() || null,
      project_id: input.projectId ?? null,
      client_id: input.clientId ?? null,
      area_id: input.areaId ?? null,
      frequency: input.frequency,
      day_of_month: dayOfMonth,
      next_create_at: firstDate.toISOString(),
      due_days: dueDays,
      end_at: input.endAt ?? null,
      max_occurrences: input.maxOccurrences ?? null,
      occurrences_created: 0,
      status: 'active',
    } satisfies TaskRecurringSeriesRow);

    taskId = spawned.taskId;

    const nextCreate = addTaskRecurrenceFrequency(
      firstDate,
      input.frequency,
      dayOfMonth,
    );
    const occurrences = 1;
    const ended =
      (input.maxOccurrences != null && occurrences >= input.maxOccurrences) ||
      (input.endAt != null && nextCreate.toISOString() > input.endAt);

    await seriesTable(client)
      .update({
        next_create_at: nextCreate.toISOString(),
        occurrences_created: occurrences,
        status: ended ? 'ended' : 'active',
      })
      .eq('id', seriesId)
      .eq('user_id', user.id);
  }

  return { seriesId, taskId };
}

async function spawnTaskFromSeries(
  client: SupabaseClient<Database>,
  series: TaskRecurringSeriesRow,
  createAt: Date = new Date(series.next_create_at),
): Promise<{ taskId: string }> {
  const createYmd = toDateOnlyIso(createAt);
  const dueYmd = addDaysYmd(createYmd, clampDueDays(series.due_days, 0));

  const result = await createTaskForUser(client, series.user_id, {
    title: series.title,
    priority: series.priority as 'low' | 'medium' | 'high' | 'urgent',
    dueDate: dueYmd,
    projectId: series.project_id ?? undefined,
    clientId: series.client_id ?? undefined,
    areaId: series.area_id ?? undefined,
    accountId: series.account_id ?? undefined,
    notes: series.notes,
    source: 'recurring',
    recurringSeriesId: series.id,
  });

  if (!result.success || !result.id) {
    throw new Error(result.error ?? 'Failed to create recurring task');
  }

  return { taskId: result.id };
}

export async function updateTaskRecurringSeriesStatus(input: {
  seriesId: string;
  status: 'active' | 'paused' | 'ended';
}) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { error } = await seriesTable(client)
    .update({ status: input.status })
    .eq('id', input.seriesId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export type TaskRecurringSeriesListItem = {
  id: string;
  title: string;
  frequency: TaskRecurrenceFrequency;
  status: 'active' | 'paused' | 'ended';
  nextCreateAt: string;
  nextCreateYmd: string;
  dueDays: number;
  occurrencesCreated: number;
  accountId: string | null;
};

/** Active/paused series waiting to spawn (or recently scheduled) for the signed-in user. */
export async function listTaskRecurringSeriesForUser(): Promise<
  TaskRecurringSeriesListItem[]
> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data, error } = await seriesTable(client)
    .select(
      'id, title, frequency, status, next_create_at, due_days, occurrences_created, account_id',
    )
    .eq('user_id', user.id)
    .in('status', ['active', 'paused'])
    .order('next_create_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const nextCreateAt = String(row.next_create_at);
    return {
      id: String(row.id),
      title: String(row.title),
      frequency: row.frequency as TaskRecurrenceFrequency,
      status: row.status as 'active' | 'paused' | 'ended',
      nextCreateAt,
      nextCreateYmd: toDateOnlyIso(nextCreateAt),
      dueDays: Number(row.due_days ?? 0),
      occurrencesCreated: Number(row.occurrences_created ?? 0),
      accountId: (row.account_id as string | null) ?? null,
    };
  });
}

/** Cron: spawn due recurring tasks (one occurrence per series per tick). */
export async function processDueTaskRecurringSeries(): Promise<{
  created: number;
}> {
  const admin = getSupabaseServerAdminClient();
  const now = new Date().toISOString();

  const { data: seriesList, error } = await seriesTable(admin)
    .select('*')
    .eq('status', 'active')
    .lte('next_create_at', now);

  if (error) {
    throw new Error(error.message);
  }

  let created = 0;

  for (const raw of seriesList ?? []) {
    const series = raw as unknown as TaskRecurringSeriesRow;
    const createAt = new Date(series.next_create_at);

    try {
      await spawnTaskFromSeries(admin, series, createAt);

      const nextCreate = addTaskRecurrenceFrequency(
        createAt,
        series.frequency,
        series.day_of_month,
      );
      const occurrences = (series.occurrences_created ?? 0) + 1;
      const ended =
        (series.max_occurrences != null &&
          occurrences >= series.max_occurrences) ||
        (series.end_at != null && nextCreate.toISOString() > series.end_at);

      await seriesTable(admin)
        .update({
          next_create_at: nextCreate.toISOString(),
          occurrences_created: occurrences,
          status: ended ? 'ended' : series.status,
        })
        .eq('id', series.id);

      created += 1;
    } catch (err) {
      console.error('[tasks] recurring spawn failed', series.id, err);
    }
  }

  return { created };
}
