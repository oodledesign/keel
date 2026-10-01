'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { unknownExportColumns } from '~/lib/commercial/disposals-export';
import {
  REPORT_SCHEDULE_SELECT,
  type ReportSchedule,
  ReportScheduleInputSchema,
  mapReportScheduleRow,
} from '~/lib/commercial/disposals-report-schedule';
import {
  type ReportRunResult,
  sendReportSchedule,
} from '~/lib/commercial/disposals-report-schedules.server';
import { looseClient } from '~/lib/retainers/loose-client';

const TABLE = 'commercial_report_schedules';

/**
 * Reports can email external addresses, so only owners and admins manage them
 * (the table's RLS says the same; this gives a clear message instead of a
 * silent empty result).
 */
async function requireOwnerOrAdmin(accountId: string) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();
  const role = membership?.account_role as string | undefined;
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Only owners and admins can manage scheduled reports');
  }
  return { client, user };
}

function assertKnownColumns(columns: string[]) {
  const unknown = unknownExportColumns(columns);
  if (unknown.length > 0) {
    throw new Error(`Unknown columns: ${unknown.join(', ')}`);
  }
}

function toRow(input: z.infer<typeof ReportScheduleInputSchema>) {
  return {
    name: input.name,
    enabled: input.enabled,
    days_of_week: input.daysOfWeek,
    send_hour: input.sendHour,
    recipients: input.recipients,
    attachments: input.attachments,
    only_when_changed: input.onlyWhenChanged,
    options: input.options,
  };
}

export const listReportSchedulesAction = enhanceAction(
  async ({ accountId }): Promise<ReportSchedule[]> => {
    const { client } = await requireOwnerOrAdmin(accountId);
    const { data, error } = await looseClient(client)
      .from(TABLE)
      .select(REPORT_SCHEDULE_SELECT)
      .eq('account_id', accountId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map(
      mapReportScheduleRow,
    );
  },
  { schema: z.object({ accountId: z.string().uuid() }) },
);

export const saveReportScheduleAction = enhanceAction(
  async ({ accountId, id, schedule }): Promise<ReportSchedule> => {
    const { client, user } = await requireOwnerOrAdmin(accountId);
    assertKnownColumns(schedule.options.columns);

    const db = looseClient(client);
    const query = id
      ? db
          .from(TABLE)
          .update(toRow(schedule))
          .eq('id', id)
          .eq('account_id', accountId)
      : db.from(TABLE).insert({
          ...toRow(schedule),
          account_id: accountId,
          created_by: user.id,
        });
    const { data, error } = await query.select(REPORT_SCHEDULE_SELECT).single();
    if (error || !data) {
      throw new Error(error?.message ?? 'Could not save the report');
    }
    return mapReportScheduleRow(data);
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      id: z.string().uuid().optional(),
      schedule: ReportScheduleInputSchema,
    }),
  },
);

export const deleteReportScheduleAction = enhanceAction(
  async ({ accountId, id }) => {
    const { client } = await requireOwnerOrAdmin(accountId);
    const { error } = await looseClient(client)
      .from(TABLE)
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      id: z.string().uuid(),
    }),
  },
);

/** Sends the saved report to the signed-in person only; no baseline change. */
export const sendTestReportAction = enhanceAction(
  async ({ accountId, id }): Promise<ReportRunResult> => {
    const { client, user } = await requireOwnerOrAdmin(accountId);
    if (!user.email) throw new Error('Your account has no email address');

    const { data } = await looseClient(client)
      .from(TABLE)
      .select(REPORT_SCHEDULE_SELECT)
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle();
    if (!data) throw new Error('Report not found');

    return sendReportSchedule(
      getSupabaseServerAdminClient(),
      mapReportScheduleRow(data),
      { testTo: user.email },
    );
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      id: z.string().uuid(),
    }),
  },
);
