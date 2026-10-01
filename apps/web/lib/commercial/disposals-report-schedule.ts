/**
 * Scheduled availability reports: the shape, validation and "is it due?" check.
 * Pure and client-safe so the reports dialog and the cron share one definition.
 */
import { z } from 'zod';

import {
  DEFAULT_EXPORT_OPTIONS,
  type DisposalsExportOptions,
  DisposalsExportOptionsSchema,
} from './disposals-export';

export const REPORT_TIME_ZONE = 'Europe/London';

export const REPORT_ATTACHMENT_FORMATS = ['pdf', 'xlsx', 'csv'] as const;
export type ReportAttachmentFormat = (typeof REPORT_ATTACHMENT_FORMATS)[number];

export const REPORT_ATTACHMENT_LABELS: Record<ReportAttachmentFormat, string> =
  { pdf: 'PDF', xlsx: 'Excel', csv: 'CSV' };

export const REPORT_MAX_RECIPIENTS = 20;

/** Sunday is 0, as in `Date#getDay`. Listed Monday first for the picker. */
export const REPORT_WEEKDAYS = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
] as const;

export const ReportScheduleInputSchema = z.object({
  name: z.string().trim().min(1, 'Give the report a name').max(120),
  enabled: z.boolean().default(true),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'Pick at least one day')
    .max(7)
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  sendHour: z.number().int().min(0).max(23),
  recipients: z
    .array(z.string().trim().toLowerCase().email('Enter valid email addresses'))
    .min(1, 'Add at least one recipient')
    .max(REPORT_MAX_RECIPIENTS)
    .transform((emails) => [...new Set(emails)]),
  attachments: z
    .array(z.enum(REPORT_ATTACHMENT_FORMATS))
    .max(REPORT_ATTACHMENT_FORMATS.length)
    .transform((formats) => [...new Set(formats)]),
  onlyWhenChanged: z.boolean().default(false),
  options: DisposalsExportOptionsSchema,
});

export type ReportScheduleInput = z.infer<typeof ReportScheduleInputSchema>;

export type ReportScheduleStatus = 'sent' | 'skipped' | 'failed';

export type ReportSchedule = {
  id: string;
  accountId: string;
  createdBy: string | null;
  name: string;
  enabled: boolean;
  daysOfWeek: number[];
  sendHour: number;
  recipients: string[];
  attachments: ReportAttachmentFormat[];
  onlyWhenChanged: boolean;
  options: DisposalsExportOptions;
  lastRunAt: string | null;
  lastStatus: ReportScheduleStatus | null;
  lastError: string | null;
};

export const DEFAULT_REPORT_INPUT: ReportScheduleInput = {
  name: 'Weekly availability',
  enabled: true,
  daysOfWeek: [1],
  sendHour: 8,
  recipients: [],
  attachments: ['pdf'],
  onlyWhenChanged: false,
  options: { ...DEFAULT_EXPORT_OPTIONS, compareToLast: true },
};

const SCHEDULE_COLUMNS =
  'id, account_id, created_by, name, enabled, days_of_week, send_hour, recipients, attachments, only_when_changed, options, last_run_at, last_status, last_error';

export const REPORT_SCHEDULE_SELECT = SCHEDULE_COLUMNS;

/** Maps a `commercial_report_schedules` row, tolerating a malformed `options`. */
export function mapReportScheduleRow(
  row: Record<string, unknown>,
): ReportSchedule {
  const parsed = DisposalsExportOptionsSchema.safeParse(row.options ?? {});
  const attachments = ((row.attachments as string[] | null) ?? []).filter(
    (value): value is ReportAttachmentFormat =>
      (REPORT_ATTACHMENT_FORMATS as readonly string[]).includes(value),
  );
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    createdBy: (row.created_by as string | null) ?? null,
    name: String(row.name ?? ''),
    enabled: row.enabled !== false,
    daysOfWeek: ((row.days_of_week as number[] | null) ?? []).map(Number),
    sendHour: Number(row.send_hour ?? 8),
    recipients: (row.recipients as string[] | null) ?? [],
    attachments,
    onlyWhenChanged: row.only_when_changed === true,
    options: parsed.success ? parsed.data : DEFAULT_EXPORT_OPTIONS,
    lastRunAt: (row.last_run_at as string | null) ?? null,
    lastStatus: (row.last_status as ReportScheduleStatus | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
  };
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Calendar day, weekday and hour on the UK clock (handles BST/GMT). */
export function londonClock(date: Date): {
  day: string;
  weekday: number;
  hour: number;
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
    hour: Number(get('hour')) % 24,
  };
}

/**
 * Due when it is a chosen weekday, the send hour has arrived (so a late cron
 * still catches up), and it has not already been dealt with today. A failed run
 * is retried on the next cron tick because nobody received it.
 */
export function isReportDue(
  schedule: Pick<
    ReportSchedule,
    'enabled' | 'daysOfWeek' | 'sendHour' | 'lastRunAt' | 'lastStatus'
  >,
  now: Date,
): boolean {
  if (!schedule.enabled) return false;
  const clock = londonClock(now);
  if (!schedule.daysOfWeek.includes(clock.weekday)) return false;
  if (clock.hour < schedule.sendHour) return false;
  if (!schedule.lastRunAt) return true;
  if (londonClock(new Date(schedule.lastRunAt)).day !== clock.day) return true;
  return schedule.lastStatus === 'failed';
}

export function formatSendHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** "Mondays at 08:00", "Mon, Wed at 08:00", "Every day at 08:00". */
export function describeSchedule(
  schedule: Pick<ReportSchedule, 'daysOfWeek' | 'sendHour'>,
): string {
  const days = REPORT_WEEKDAYS.filter((day) =>
    schedule.daysOfWeek.includes(day.value),
  );
  const time = formatSendHour(schedule.sendHour);
  if (days.length === 7) return `Every day at ${time}`;
  if (days.length === 1) return `${days[0]!.long}s at ${time}`;
  return `${days.map((day) => day.short).join(', ')} at ${time}`;
}
