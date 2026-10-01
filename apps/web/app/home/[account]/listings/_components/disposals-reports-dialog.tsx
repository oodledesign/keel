'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Loader2, Mail, Pencil, Plus, Send, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import {
  DEFAULT_REPORT_INPUT,
  REPORT_ATTACHMENT_FORMATS,
  REPORT_ATTACHMENT_LABELS,
  REPORT_MAX_RECIPIENTS,
  REPORT_WEEKDAYS,
  type ReportSchedule,
  type ReportScheduleInput,
  ReportScheduleInputSchema,
  describeSchedule,
  formatSendHour,
} from '~/lib/commercial/disposals-report-schedule';
import {
  workspaceBtnPrimaryMd,
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

import {
  deleteReportScheduleAction,
  listReportSchedulesAction,
  saveReportScheduleAction,
  sendTestReportAction,
} from '../_lib/server/report-schedule-actions';
import {
  DisposalsExportFields,
  type ExportOffice,
  cleanExportOptions,
  exportSectionTitle,
} from './disposals-export-fields';

type Editing = {
  id?: string;
  draft: ReportScheduleInput;
  /** Free text so people can paste a list; parsed on save. */
  recipientsText: string;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function splitRecipients(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  // Zod errors arrive as JSON text; pull out the first human message.
  try {
    const parsed = JSON.parse(error.message) as Array<{ message?: string }>;
    const first = parsed[0]?.message;
    if (first) return first;
  } catch {
    // Not JSON: use the message as it is.
  }
  return error.message || fallback;
}

function lastRunText(schedule: ReportSchedule): string {
  if (!schedule.lastRunAt || !schedule.lastStatus) return 'Not sent yet';
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(schedule.lastRunAt));
  const status =
    schedule.lastStatus === 'sent'
      ? 'Sent'
      : schedule.lastStatus === 'skipped'
        ? 'Skipped (no changes)'
        : 'Failed';
  return `${status} ${when}`;
}

export function DisposalsReportsDialog({
  accountId,
  offices,
  open,
  onOpenChange,
}: {
  accountId: string;
  offices: ExportOffice[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [schedules, setSchedules] = useState<ReportSchedule[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const officeIdSet = useMemo(
    () => new Set(offices.map((office) => office.id)),
    [offices],
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setSchedules(await listReportSchedulesAction({ accountId }));
    } catch (error) {
      setSchedules([]);
      setLoadError(errorMessage(error, 'Could not load the scheduled reports'));
    }
  }, [accountId]);

  useEffect(() => {
    if (open) {
      setEditing(null);
      void load();
    }
  }, [open, load]);

  const startNew = () =>
    setEditing({
      draft: DEFAULT_REPORT_INPUT,
      recipientsText: '',
    });

  const startEdit = (schedule: ReportSchedule) =>
    setEditing({
      id: schedule.id,
      recipientsText: schedule.recipients.join('\n'),
      draft: {
        name: schedule.name,
        enabled: schedule.enabled,
        daysOfWeek: schedule.daysOfWeek,
        sendHour: schedule.sendHour,
        recipients: schedule.recipients,
        attachments: schedule.attachments,
        onlyWhenChanged: schedule.onlyWhenChanged,
        options:
          cleanExportOptions(schedule.options, officeIdSet) ??
          DEFAULT_REPORT_INPUT.options,
      },
    });

  const save = async () => {
    if (!editing) return;
    const parsed = ReportScheduleInputSchema.safeParse({
      ...editing.draft,
      recipients: splitRecipients(editing.recipientsText),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Check the report');
      return;
    }
    setBusy('save');
    try {
      await saveReportScheduleAction({
        accountId,
        id: editing.id,
        schedule: parsed.data,
      });
      toast.success('Report saved');
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the report'));
    } finally {
      setBusy(null);
    }
  };

  const toggleEnabled = async (schedule: ReportSchedule, enabled: boolean) => {
    setBusy(schedule.id);
    try {
      await saveReportScheduleAction({
        accountId,
        id: schedule.id,
        schedule: {
          name: schedule.name,
          enabled,
          daysOfWeek: schedule.daysOfWeek,
          sendHour: schedule.sendHour,
          recipients: schedule.recipients,
          attachments: schedule.attachments,
          onlyWhenChanged: schedule.onlyWhenChanged,
          options: schedule.options,
        },
      });
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update the report'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (schedule: ReportSchedule) => {
    if (!window.confirm(`Delete “${schedule.name}”? It will stop sending.`)) {
      return;
    }
    setBusy(schedule.id);
    try {
      await deleteReportScheduleAction({ accountId, id: schedule.id });
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete the report'));
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async (schedule: ReportSchedule) => {
    setBusy(`test:${schedule.id}`);
    try {
      const result = await sendTestReportAction({
        accountId,
        id: schedule.id,
      });
      if (result.status === 'sent') {
        toast.success('Test sent to your email address');
      } else if (result.status === 'skipped') {
        toast.message(result.detail ?? 'Nothing to send');
      } else {
        toast.error(result.detail ?? 'Could not send the test');
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not send the test'));
    } finally {
      setBusy(null);
    }
  };

  const updateDraft = (patch: Partial<ReportScheduleInput>) =>
    setEditing((current) =>
      current ? { ...current, draft: { ...current.draft, ...patch } } : current,
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0"
        data-test="disposals-reports-dialog"
      >
        <DialogHeader className="border-b border-[color:var(--workspace-shell-border)] px-6 py-4">
          <DialogTitle className="text-[var(--workspace-shell-text)]">
            {editing
              ? editing.id
                ? 'Edit report'
                : 'New scheduled report'
              : 'Scheduled reports'}
          </DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            {editing
              ? 'The report is emailed on the days and time you pick (UK time), with new and changed disposals highlighted.'
              : 'Email an availability report to the team on a schedule, with what has changed since the last one.'}
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <>
            <div className="space-y-6 overflow-y-auto px-6 py-5">
              <section className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="report-name" className={exportSectionTitle}>
                    Name
                  </Label>
                  <Input
                    id="report-name"
                    value={editing.draft.name}
                    maxLength={120}
                    onChange={(event) =>
                      updateDraft({ name: event.target.value })
                    }
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <span className={exportSectionTitle}>Send on</span>
                  <div className="flex flex-wrap gap-1.5">
                    {REPORT_WEEKDAYS.map((day) => {
                      const on = editing.draft.daysOfWeek.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          aria-pressed={on}
                          aria-label={day.long}
                          onClick={() =>
                            updateDraft({
                              daysOfWeek: on
                                ? editing.draft.daysOfWeek.filter(
                                    (value) => value !== day.value,
                                  )
                                : [...editing.draft.daysOfWeek, day.value],
                            })
                          }
                          className={`h-8 min-w-12 rounded-full border px-3 text-sm transition-colors ${
                            on
                              ? 'border-transparent bg-[var(--ozer-accent-subtle)] font-medium text-[var(--workspace-shell-accent-text)]'
                              : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
                          }`}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className={exportSectionTitle}>At (UK time)</Label>
                  <Select
                    value={String(editing.draft.sendHour)}
                    onValueChange={(value) =>
                      updateDraft({ sendHour: Number(value) })
                    }
                  >
                    <SelectTrigger aria-label="Send time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={workspaceSelectContentClass}>
                      {HOURS.map((hour) => (
                        <SelectItem
                          key={hour}
                          value={String(hour)}
                          className={workspaceSelectItemClass}
                        >
                          {formatSendHour(hour)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <span className={exportSectionTitle}>Attach</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5">
                    {REPORT_ATTACHMENT_FORMATS.map((format) => (
                      <div key={format} className="flex items-center gap-2">
                        <Checkbox
                          id={`report-attach-${format}`}
                          checked={editing.draft.attachments.includes(format)}
                          onCheckedChange={(checked) =>
                            updateDraft({
                              attachments:
                                checked === true
                                  ? [...editing.draft.attachments, format]
                                  : editing.draft.attachments.filter(
                                      (value) => value !== format,
                                    ),
                            })
                          }
                        />
                        <Label
                          htmlFor={`report-attach-${format}`}
                          className="cursor-pointer text-sm font-normal text-[var(--workspace-shell-text)]"
                        >
                          {REPORT_ATTACHMENT_LABELS[format]}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label
                    htmlFor="report-recipients"
                    className={exportSectionTitle}
                  >
                    Recipients
                  </Label>
                  <Textarea
                    id="report-recipients"
                    rows={3}
                    placeholder="name@company.com, another@company.com"
                    value={editing.recipientsText}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        recipientsText: event.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Separate addresses with commas or new lines (up to{' '}
                    {REPORT_MAX_RECIPIENTS}). Anyone you add receives the
                    report, whether or not they use this workspace.
                  </p>
                </div>

                <div className="flex items-start gap-2 sm:col-span-2">
                  <Checkbox
                    id="report-only-changed"
                    checked={editing.draft.onlyWhenChanged}
                    onCheckedChange={(checked) =>
                      updateDraft({ onlyWhenChanged: checked === true })
                    }
                  />
                  <Label
                    htmlFor="report-only-changed"
                    className="cursor-pointer text-sm leading-snug font-normal text-[var(--workspace-shell-text)]"
                  >
                    Only send when something has changed
                    <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
                      Skips quiet weeks. The first report is always sent.
                    </span>
                  </Label>
                </div>
              </section>

              <div className="border-t border-[color:var(--workspace-shell-border)] pt-5">
                <p className="mb-4 text-sm text-[var(--workspace-shell-text-muted)]">
                  What goes in the report. Disposals restricted to their own
                  agents are never included.
                </p>
                <DisposalsExportFields
                  options={editing.draft.options}
                  offices={offices}
                  onChange={(options) =>
                    updateDraft({
                      options: { ...options, compareToLast: true },
                    })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[color:var(--workspace-shell-border)] px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                disabled={busy === 'save'}
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={workspaceBtnPrimaryMd}
                disabled={busy === 'save'}
                onClick={save}
                data-test="disposals-report-save"
              >
                {busy === 'save' ? (
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                ) : null}
                Save report
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3 overflow-y-auto px-6 py-5">
              {schedules === null ? (
                <p className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                  Loading…
                </p>
              ) : null}

              {loadError ? (
                <p className="text-sm text-rose-500" role="alert">
                  {loadError}
                </p>
              ) : null}

              {schedules?.length === 0 && !loadError ? (
                <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center">
                  <Mail
                    aria-hidden
                    className="mx-auto mb-2 h-6 w-6 text-[var(--workspace-shell-text-muted)]"
                  />
                  <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                    No scheduled reports yet
                  </p>
                  <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                    Set one up and the availability list lands in the inbox each
                    week, with what has changed.
                  </p>
                </div>
              ) : null}

              {schedules?.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] px-4 py-3"
                  data-test="disposals-report-row"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {schedule.name}
                    </p>
                    <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                      {describeSchedule(schedule)} ·{' '}
                      {schedule.recipients.length} recipient
                      {schedule.recipients.length === 1 ? '' : 's'}
                    </p>
                    <p
                      className={`text-xs ${
                        schedule.lastStatus === 'failed'
                          ? 'text-rose-500'
                          : 'text-[var(--workspace-shell-text-muted)]'
                      }`}
                      title={schedule.lastError ?? undefined}
                    >
                      {lastRunText(schedule)}
                    </p>
                  </div>
                  <Switch
                    checked={schedule.enabled}
                    disabled={busy === schedule.id}
                    onCheckedChange={(checked) =>
                      toggleEnabled(schedule, checked)
                    }
                    aria-label={`${schedule.name} is ${schedule.enabled ? 'on' : 'off'}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={busy === `test:${schedule.id}`}
                    onClick={() => sendTest(schedule)}
                  >
                    {busy === `test:${schedule.id}` ? (
                      <Loader2
                        aria-hidden
                        className="h-3.5 w-3.5 animate-spin"
                      />
                    ) : (
                      <Send aria-hidden className="h-3.5 w-3.5" />
                    )}
                    Send me a test
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${schedule.name}`}
                    onClick={() => startEdit(schedule)}
                  >
                    <Pencil aria-hidden className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${schedule.name}`}
                    disabled={busy === schedule.id}
                    onClick={() => remove(schedule)}
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end border-t border-[color:var(--workspace-shell-border)] px-6 py-4">
              <Button
                type="button"
                className={workspaceBtnPrimaryMd}
                onClick={startNew}
                disabled={schedules === null}
                data-test="disposals-report-new"
              >
                <Plus aria-hidden className="h-4 w-4" />
                New report
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
