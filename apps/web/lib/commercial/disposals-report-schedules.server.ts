import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getAppSiteOrigin } from '~/lib/app-host-routing';
import { wrapNotificationEmail } from '~/lib/email/wrap-notification-email';
import { looseClient } from '~/lib/retainers/loose-client';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';
import { buildXlsxWorkbook } from '~/lib/spreadsheet/xlsx-workbook';

import {
  buildDisposalsExportTable,
  buildExportSnapshot,
  exportTableToCsv,
  exportTableToSheet,
  toTextTable,
} from './disposals-export';
import { type ChangeBaseline } from './disposals-export-changes';
import { buildExportPdf } from './disposals-export-pdf';
import {
  loadStoredSnapshots,
  rollSnapshotForward,
  scheduleSnapshotKey,
} from './disposals-export-snapshots.server';
import { renderReportEmailBody } from './disposals-report-email';
import {
  REPORT_SCHEDULE_SELECT,
  type ReportAttachmentFormat,
  type ReportSchedule,
  type ReportScheduleStatus,
  isReportDue,
  mapReportScheduleRow,
} from './disposals-report-schedule';
import { loadDisposalsScheduleInput } from './load-disposals-schedule.server';

export type ReportRunResult = {
  status: ReportScheduleStatus;
  /** Recipients that received the email. */
  sent: number;
  detail: string | null;
};

const MIME_TYPES: Record<ReportAttachmentFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

function londonStamp(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(',', '');
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Build and send one report. `testTo` sends only to that address and leaves
 * the "changed since" baseline alone, so a test never hides changes from the
 * real email.
 */
export async function sendReportSchedule(
  admin: SupabaseClient,
  schedule: ReportSchedule,
  params: { now?: Date; testTo?: string } = {},
): Promise<ReportRunResult> {
  const now = params.now ?? new Date();
  const isTest = Boolean(params.testTo);
  const sender = process.env.EMAIL_SENDER?.trim();
  if (!sender) {
    return { status: 'failed', sent: 0, detail: 'EMAIL_SENDER is not set' };
  }

  const db = looseClient(admin);
  const { data: account } = await admin
    .from('accounts')
    .select('slug, name')
    .eq('id', schedule.accountId)
    .maybeSingle();
  if (!account?.slug) {
    return { status: 'failed', sent: 0, detail: 'Workspace not found' };
  }

  // Scheduled emails go to people who may not be on a restricted disposal, so
  // they never include one (an unmatched user id keeps the "assigned" rule off).
  const input = await loadDisposalsScheduleInput({
    client: admin,
    accountId: schedule.accountId,
    accountSlug: account.slug,
    userId: 'scheduled-report',
    canSeeRestricted: false,
  });

  const snapshotKey = scheduleSnapshotKey(schedule.id);
  const stored = await loadStoredSnapshots(
    db,
    schedule.accountId,
    snapshotKey,
  ).catch(() => null);
  const baseline: ChangeBaseline | null = stored
    ? { takenAt: stored.takenAt, rows: stored.snapshot }
    : null;

  const table = buildDisposalsExportTable(
    input,
    schedule.options,
    londonStamp(now),
    { baseline },
  );

  if (table.rowCount === 0 && !table.hasChanges) {
    return { status: 'skipped', sent: 0, detail: 'No disposals match' };
  }
  if (schedule.onlyWhenChanged && baseline && !table.hasChanges && !isTest) {
    return { status: 'skipped', sent: 0, detail: 'No changes this week' };
  }

  const dateStamp = now.toISOString().slice(0, 10);
  const textTable = toTextTable(table);
  const attachments: Array<{
    name: string;
    content: string;
    mimeType: string;
  }> = [];
  for (const format of schedule.attachments) {
    const bytes =
      format === 'pdf'
        ? await buildExportPdf(textTable)
        : format === 'xlsx'
          ? buildXlsxWorkbook([exportTableToSheet(table)])
          : Buffer.from(exportTableToCsv(table), 'utf8');
    attachments.push({
      name: `availability-schedule-${dateStamp}.${format}`,
      content: Buffer.from(bytes).toString('base64'),
      mimeType: MIME_TYPES[format],
    });
  }

  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
  const origin = getAppSiteOrigin();
  const href = `${origin}/app/${account.slug}/listings`;
  const subjectTail = table.changeSummary
    ? `${table.changeSummary}`
    : `${table.rowCount} disposal${table.rowCount === 1 ? '' : 's'}`;
  const subject = `${isTest ? '[Test] ' : ''}${schedule.name}: ${subjectTail}`;
  const html = wrapNotificationEmail(
    renderReportEmailBody(textTable, {
      attachmentNames: attachments.map((file) => file.name),
    }),
    {
      title: schedule.name,
      heading: schedule.name,
      preview: table.changeSummary ?? `${table.rowCount} disposals`,
      cta: { label: 'Open disposals', href },
      productName,
    },
  );

  const recipients = params.testTo ? [params.testTo] : schedule.recipients;
  const failures: string[] = [];
  let sent = 0;
  for (const to of recipients) {
    try {
      await sendPlatformEmail({
        type: 'commercial_availability_report',
        accountId: schedule.accountId,
        mail: {
          from: sender,
          to,
          subject,
          html,
          ...(attachments.length > 0 ? { attachments } : {}),
        },
        metadata: {
          event: 'commercial_availability_report',
          schedule_id: schedule.id,
          test: isTest,
          row_count: table.rowCount,
        },
      });
      sent += 1;
    } catch (error) {
      failures.push(`${to}: ${message(error)}`);
    }
  }

  if (sent === 0) {
    return { status: 'failed', sent: 0, detail: failures.join('; ') };
  }

  if (!isTest) {
    try {
      await rollSnapshotForward(db, {
        accountId: schedule.accountId,
        key: snapshotKey,
        snapshot: buildExportSnapshot(input, schedule.options),
        stored,
        now,
      });
    } catch {
      // The email went out; the next one just compares with an older baseline.
    }
  }

  return {
    status: 'sent',
    sent,
    detail: failures.length > 0 ? failures.join('; ') : null,
  };
}

/** Record the outcome of a real (non-test) run on the schedule row. */
export async function recordReportRun(
  admin: SupabaseClient,
  scheduleId: string,
  result: ReportRunResult,
  now: Date,
) {
  await looseClient(admin)
    .from('commercial_report_schedules')
    .update({
      last_run_at: now.toISOString(),
      last_status: result.status,
      last_error: result.detail,
    })
    .eq('id', scheduleId);
}

/** True when this invocation won the right to run the schedule. */
async function claimReportRun(
  admin: SupabaseClient,
  schedule: ReportSchedule,
  now: Date,
): Promise<boolean> {
  const update = looseClient(admin)
    .from('commercial_report_schedules')
    .update({
      last_run_at: now.toISOString(),
      last_status: 'failed',
      last_error: 'Interrupted before it finished',
    })
    .eq('id', schedule.id);
  const guarded = schedule.lastRunAt
    ? update.eq('last_run_at', schedule.lastRunAt)
    : update.is('last_run_at', null);
  const { data } = await guarded.select('id');
  return Array.isArray(data) && data.length > 0;
}

/** Cron entry: send every report that is due on the UK clock. */
export async function runDueReportSchedules(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<{ due: number; sent: number; skipped: number; failed: number }> {
  const { data, error } = await looseClient(admin)
    .from('commercial_report_schedules')
    .select(REPORT_SCHEDULE_SELECT)
    .eq('enabled', true);
  if (error) throw new Error(error.message);

  const due = ((data ?? []) as Array<Record<string, unknown>>)
    .map(mapReportScheduleRow)
    .filter((schedule) => isReportDue(schedule, now));

  const totals = { due: due.length, sent: 0, skipped: 0, failed: 0 };
  for (const schedule of due) {
    // Claim the run first so an overlapping cron invocation skips this report
    // instead of emailing everyone twice. If we crash mid-send the row stays
    // "failed", so the next tick retries.
    if (!(await claimReportRun(admin, schedule, now))) continue;

    let result: ReportRunResult;
    try {
      result = await sendReportSchedule(admin, schedule, { now });
    } catch (error) {
      result = { status: 'failed', sent: 0, detail: message(error) };
    }
    await recordReportRun(admin, schedule.id, result, now).catch(() => {});
    totals[result.status] += 1;
  }
  return totals;
}
