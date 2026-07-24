'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { Calendar, Loader2, Unplug } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import {
  DisconnectIntegrationDialog,
  GOOGLE_CALENDAR_DISCONNECT_CONSEQUENCES,
} from '~/components/integrations/disconnect-integration-dialog';
import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import type { AccountTaskAutomationSettings } from '~/lib/recorder/task-automation-settings';

import {
  disconnectGoogleCalendarFromWorkspaceAction,
  saveAccountTaskAutomationSettingsAction,
  saveGoogleCalendarSelectionAction,
} from '../_lib/server/task-automation-settings-actions';
import type { TaskAutomationSettingsPageData } from '../_lib/server/task-automation-settings.loader';

type Props = {
  data: TaskAutomationSettingsPageData;
  canEdit: boolean;
};

function modeLabel(mode: AccountTaskAutomationSettings['meetingTasksMode']) {
  return mode === 'auto_publish' ? 'Auto-publish' : 'Require my review';
}

export function TaskAutomationSettingsForm({ data, canEdit }: Props) {
  const [settings, setSettings] = useState(data.settings);
  const [selections, setSelections] = useState<
    Record<string, { busyCalendarIds: string[]; personalCalendarIds: string[] }>
  >(() =>
    Object.fromEntries(
      data.calendar.accounts.map((account) => [
        account.connectionId,
        {
          busyCalendarIds:
            account.busyCalendarIds.length > 0
              ? account.busyCalendarIds
              : data.calendar.calendars
                  .filter(
                    (calendar) =>
                      calendar.connectionId === account.connectionId &&
                      calendar.selected,
                  )
                  .map((calendar) => calendar.id),
          personalCalendarIds: account.personalCalendarIds,
        },
      ]),
    ),
  );
  const [pending, startTransition] = useTransition();
  const [disconnectTarget, setDisconnectTarget] = useState<{
    connectionId?: string;
    email?: string | null;
  } | null>(null);

  const reviewPath = workAccountPath(
    pathsConfig.app.accountTasksReview,
    data.accountSlug,
  );

  const calendarsByAccount = useMemo(() => {
    const map = new Map<string, typeof data.calendar.calendars>();
    for (const calendar of data.calendar.calendars) {
      const list = map.get(calendar.connectionId) ?? [];
      list.push(calendar);
      map.set(calendar.connectionId, list);
    }
    return map;
  }, [data.calendar.calendars]);

  function toggleBusyCalendar(
    connectionId: string,
    calendarId: string,
    checked: boolean,
  ) {
    setSelections((current) => {
      const existing = current[connectionId] ?? {
        busyCalendarIds: [],
        personalCalendarIds: [],
      };
      return {
        ...current,
        [connectionId]: {
          busyCalendarIds: checked
            ? existing.busyCalendarIds.includes(calendarId)
              ? existing.busyCalendarIds
              : [...existing.busyCalendarIds, calendarId]
            : existing.busyCalendarIds.filter((id) => id !== calendarId),
          personalCalendarIds: checked
            ? existing.personalCalendarIds
            : existing.personalCalendarIds.filter((id) => id !== calendarId),
        },
      };
    });
  }

  function togglePersonalCalendar(
    connectionId: string,
    calendarId: string,
    checked: boolean,
  ) {
    setSelections((current) => {
      const existing = current[connectionId] ?? {
        busyCalendarIds: [],
        personalCalendarIds: [],
      };
      return {
        ...current,
        [connectionId]: {
          ...existing,
          personalCalendarIds: checked
            ? existing.personalCalendarIds.includes(calendarId)
              ? existing.personalCalendarIds
              : [...existing.personalCalendarIds, calendarId]
            : existing.personalCalendarIds.filter((id) => id !== calendarId),
        },
      };
    });
  }

  function saveSettings() {
    if (!canEdit) return;

    startTransition(async () => {
      try {
        const saved = await saveAccountTaskAutomationSettingsAction({
          accountId: data.accountId,
          accountSlug: data.accountSlug,
          meetingTasksMode: settings.meetingTasksMode,
          emailTasksMode: settings.emailTasksMode,
          autoScheduleOnCalendar: settings.autoScheduleOnCalendar,
          calendarLeadTimeMinutes: settings.calendarLeadTimeMinutes,
          workingHoursStart: settings.workingHoursStart,
          workingHoursEnd: settings.workingHoursEnd,
          excludePersonalCalendarBusy: settings.excludePersonalCalendarBusy,
        });
        setSettings(saved);

        if (data.calendar.connected) {
          await saveGoogleCalendarSelectionAction({
            accountSlug: data.accountSlug,
            selections: Object.entries(selections).map(
              ([connectionId, selection]) => ({
                connectionId,
                busyCalendarIds: selection.busyCalendarIds,
                personalCalendarIds: selection.personalCalendarIds,
              }),
            ),
          });
        }

        toast.success('Task automation settings saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Save failed');
      }
    });
  }

  function disconnectCalendar(connectionId?: string) {
    if (!canEdit) return;

    startTransition(async () => {
      try {
        await disconnectGoogleCalendarFromWorkspaceAction({
          accountSlug: data.accountSlug,
          connectionId,
        });
        setDisconnectTarget(null);
        toast.success(
          connectionId
            ? 'Google account disconnected'
            : 'Google Calendar disconnected',
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not disconnect Google Calendar',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
              Current review mode
            </h2>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              Meeting tasks: {modeLabel(settings.meetingTasksMode)} · Email
              tasks: {modeLabel(settings.emailTasksMode)}
            </p>
          </div>
          <Link
            href={reviewPath}
            className="text-sm font-medium text-[var(--ozer-accent)] hover:underline"
          >
            Open review queue
          </Link>
        </div>
      </div>

      <section className="space-y-5 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Meeting tasks
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            High-confidence suggestions can auto-publish when enabled. Ambiguous
            assignees always require review.
          </p>
        </div>
        <ModeRadioGroup
          value={settings.meetingTasksMode}
          disabled={!canEdit || pending}
          onChange={(meetingTasksMode) =>
            setSettings((current) => ({ ...current, meetingTasksMode }))
          }
        />
      </section>

      <section className="space-y-5 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Email tasks
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Same moderation rules apply to email action item suggestions.
          </p>
        </div>
        <ModeRadioGroup
          value={settings.emailTasksMode}
          disabled={!canEdit || pending}
          onChange={(emailTasksMode) =>
            setSettings((current) => ({ ...current, emailTasksMode }))
          }
        />
      </section>

      <section className="space-y-5 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Calendar auto-scheduling
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            When a task is published with a due date, Ozer can block time on the
            assignee&apos;s Google Calendar before the deadline.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <div>
            <Label className="text-[var(--workspace-shell-text)]">
              Auto-schedule approved tasks on my calendar
            </Label>
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              Uses the assignee&apos;s connected Google Calendar when a task is
              approved.
            </p>
          </div>
          <Switch
            checked={settings.autoScheduleOnCalendar}
            disabled={!canEdit || pending}
            onCheckedChange={(autoScheduleOnCalendar) =>
              setSettings((current) => ({ ...current, autoScheduleOnCalendar }))
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">
              Lead time before due date (minutes)
            </Label>
            <Input
              type="number"
              min={0}
              max={1440}
              value={settings.calendarLeadTimeMinutes}
              disabled={!canEdit || pending}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  calendarLeadTimeMinutes: Number(event.target.value) || 0,
                }))
              }
              className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">
              Working hours
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={settings.workingHoursStart}
                disabled={!canEdit || pending}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    workingHoursStart: event.target.value,
                  }))
                }
                className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]"
              />
              <span className="text-[var(--workspace-shell-text-muted)]">
                to
              </span>
              <Input
                type="time"
                value={settings.workingHoursEnd}
                disabled={!canEdit || pending}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    workingHoursEnd: event.target.value,
                  }))
                }
                className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <div>
            <Label className="text-[var(--workspace-shell-text)]">
              Include personal calendar when finding free time
            </Label>
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              When off, events on calendars marked personal below are ignored
              for busy time.
            </p>
          </div>
          <Switch
            checked={!settings.excludePersonalCalendarBusy}
            disabled={!canEdit || pending}
            onCheckedChange={(includePersonal) =>
              setSettings((current) => ({
                ...current,
                excludePersonalCalendarBusy: !includePersonal,
              }))
            }
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
              Google Calendar connection
            </h2>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              Connect work and personal Google accounts for busy-time checks,
              public booking slots, and auto-scheduling tasks assigned to you.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                data.calendar.connected
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                  : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]'
              }
            >
              {data.calendar.connected
                ? `${data.calendar.accountCount} connected`
                : 'Not connected'}
            </Badge>
            {data.calendar.configured && canEdit ? (
              <Button
                type="button"
                className="ozer-gradient-btn text-[var(--ozer-white)]"
                onClick={() => {
                  window.location.href = data.calendar.connectHref;
                }}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {data.calendar.connected
                  ? 'Add Google account'
                  : 'Connect Google Calendar'}
              </Button>
            ) : null}
          </div>
        </div>

        {!data.calendar.configured ? (
          <p className="text-sm text-amber-100/90">
            Google Calendar OAuth is not configured on this server yet.
          </p>
        ) : !data.calendar.connected ? (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            No Google accounts connected yet.
          </p>
        ) : data.calendar.accounts.length === 0 ? (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            No calendars returned from Google.
          </p>
        ) : (
          <div className="space-y-4">
            {data.calendar.accounts.map((account) => {
              const selection = selections[account.connectionId] ?? {
                busyCalendarIds: [],
                personalCalendarIds: [],
              };
              const calendars =
                calendarsByAccount.get(account.connectionId) ?? [];

              return (
                <div
                  key={account.connectionId}
                  className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                      {account.email ?? 'Google account'}
                      {account.isPrimary ? ' · primary' : ''}
                    </p>
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-panel)]"
                        disabled={pending}
                        onClick={() =>
                          setDisconnectTarget({
                            connectionId: account.connectionId,
                            email: account.email,
                          })
                        }
                      >
                        {pending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Unplug className="mr-2 h-4 w-4" />
                        )}
                        Disconnect
                      </Button>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    {calendars.map((calendar) => {
                      const key = `${account.connectionId}:${calendar.id}`;
                      const busy = selection.busyCalendarIds.includes(
                        calendar.id,
                      );
                      const personal = selection.personalCalendarIds.includes(
                        calendar.id,
                      );
                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <Checkbox
                              id={`busy-${key}`}
                              checked={busy}
                              disabled={!canEdit || pending}
                              onCheckedChange={(checked) =>
                                toggleBusyCalendar(
                                  account.connectionId,
                                  calendar.id,
                                  checked === true,
                                )
                              }
                            />
                            <Label
                              htmlFor={`busy-${key}`}
                              className="text-sm text-[var(--workspace-shell-text)]"
                            >
                              {calendar.summary}
                              {calendar.primary ? ' (primary)' : ''}
                            </Label>
                          </div>
                          {busy ? (
                            <div className="mt-3 ml-7 flex items-center gap-2">
                              <Checkbox
                                id={`personal-${key}`}
                                checked={personal}
                                disabled={!canEdit || pending}
                                onCheckedChange={(checked) =>
                                  togglePersonalCalendar(
                                    account.connectionId,
                                    calendar.id,
                                    checked === true,
                                  )
                                }
                              />
                              <Label
                                htmlFor={`personal-${key}`}
                                className="text-xs text-[var(--workspace-shell-text-muted)]"
                              >
                                Treat as personal calendar
                              </Label>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {canEdit ? (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={saveSettings}
            disabled={pending}
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save settings'
            )}
          </Button>
        </div>
      ) : null}

      <DisconnectIntegrationDialog
        open={disconnectTarget !== null}
        onOpenChange={(open) => !open && setDisconnectTarget(null)}
        title="Disconnect Google Calendar?"
        description={
          disconnectTarget?.email
            ? `This removes Ozer’s access to ${disconnectTarget.email}.`
            : 'This removes Ozer’s access to this Google Calendar account.'
        }
        consequences={[...GOOGLE_CALENDAR_DISCONNECT_CONSEQUENCES]}
        confirming={pending && disconnectTarget !== null}
        onConfirm={() => disconnectCalendar(disconnectTarget?.connectionId)}
      />
    </div>
  );
}

function ModeRadioGroup({
  value,
  disabled,
  onChange,
}: {
  value: 'auto_publish' | 'requires_moderation';
  disabled: boolean;
  onChange: (value: 'auto_publish' | 'requires_moderation') => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(
        [
          {
            id: 'requires_moderation',
            title: 'Require my review',
            description: 'Suggestions land in the review queue first.',
          },
          {
            id: 'auto_publish',
            title: 'Auto-publish',
            description:
              'High-confidence items publish without manual approval.',
          },
        ] as const
      ).map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.id)}
          className={`rounded-xl border p-4 text-left transition-colors ${
            value === option.id
              ? 'border-[var(--ozer-accent)]/50 bg-[var(--ozer-accent-subtle)]'
              : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] hover:bg-[var(--workspace-shell-sidebar-accent)]'
          }`}
        >
          <div className="text-sm font-medium text-[var(--workspace-shell-text)]">
            {option.title}
          </div>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            {option.description}
          </p>
        </button>
      ))}
    </div>
  );
}
