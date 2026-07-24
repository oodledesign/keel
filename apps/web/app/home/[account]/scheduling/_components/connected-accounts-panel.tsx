'use client';

import { useMemo, useState, useTransition } from 'react';

import { Calendar, Loader2, Plus, Unplug, Video } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  DisconnectIntegrationDialog,
  GOOGLE_CALENDAR_DISCONNECT_CONSEQUENCES,
} from '~/components/integrations/disconnect-integration-dialog';
import {
  workspaceBtnPrimaryMd,
  workspacePanelBorder,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  disconnectGoogleCalendarFromWorkspaceAction,
  saveGoogleCalendarSelectionAction,
} from '../../settings/_lib/server/task-automation-settings-actions';
import { disconnectConferencingAction } from '../_lib/server/scheduling-actions';
import type { ConferencingConnectionRow } from '../_lib/server/scheduling.service';

type GoogleCalendarOption = {
  id: string;
  summary: string;
  primary: boolean;
  selected: boolean;
  connectionId: string;
  accountEmail: string | null;
};

type GoogleAccount = {
  connectionId: string;
  email: string | null;
  isPrimary: boolean;
  busyCalendarIds: string[];
  personalCalendarIds: string[];
};

type Props = {
  accountSlug: string;
  canEdit: boolean;
  google: {
    configured: boolean;
    connected: boolean;
    accountCount: number;
    connectHref: string;
    accounts: GoogleAccount[];
    calendars: GoogleCalendarOption[];
  };
  zoom: {
    configured: boolean;
    connectHref: string;
  };
  teams: {
    configured: boolean;
    connectHref: string;
  };
  conferencing: ConferencingConnectionRow[];
};

type AccountSelection = {
  busyCalendarIds: string[];
  personalCalendarIds: string[];
};

export function ConnectedAccountsPanel({
  accountSlug,
  canEdit,
  google,
  zoom,
  teams,
  conferencing,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [disconnectTarget, setDisconnectTarget] = useState<{
    connectionId?: string;
    email?: string | null;
  } | null>(null);
  const [selections, setSelections] = useState<
    Record<string, AccountSelection>
  >(() =>
    Object.fromEntries(
      google.accounts.map((account) => [
        account.connectionId,
        {
          busyCalendarIds:
            account.busyCalendarIds.length > 0
              ? account.busyCalendarIds
              : google.calendars
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

  const zoomConnection = conferencing.find((item) => item.provider === 'zoom');
  const teamsConnection = conferencing.find(
    (item) => item.provider === 'teams',
  );

  const calendarsByAccount = useMemo(() => {
    const map = new Map<string, GoogleCalendarOption[]>();
    for (const calendar of google.calendars) {
      const list = map.get(calendar.connectionId) ?? [];
      list.push(calendar);
      map.set(calendar.connectionId, list);
    }
    return map;
  }, [google.calendars]);

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
      const busyCalendarIds = checked
        ? existing.busyCalendarIds.includes(calendarId)
          ? existing.busyCalendarIds
          : [...existing.busyCalendarIds, calendarId]
        : existing.busyCalendarIds.filter((id) => id !== calendarId);
      const personalCalendarIds = checked
        ? existing.personalCalendarIds
        : existing.personalCalendarIds.filter((id) => id !== calendarId);

      return {
        ...current,
        [connectionId]: { busyCalendarIds, personalCalendarIds },
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
      const personalCalendarIds = checked
        ? existing.personalCalendarIds.includes(calendarId)
          ? existing.personalCalendarIds
          : [...existing.personalCalendarIds, calendarId]
        : existing.personalCalendarIds.filter((id) => id !== calendarId);

      return {
        ...current,
        [connectionId]: { ...existing, personalCalendarIds },
      };
    });
  }

  function saveCalendarSelection() {
    if (!canEdit) return;

    startTransition(async () => {
      try {
        await saveGoogleCalendarSelectionAction({
          accountSlug,
          selections: Object.entries(selections).map(
            ([connectionId, selection]) => ({
              connectionId,
              busyCalendarIds: selection.busyCalendarIds,
              personalCalendarIds: selection.personalCalendarIds,
            }),
          ),
        });
        toast.success('Calendar availability settings saved');
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not save calendar selection',
        );
      }
    });
  }

  function disconnectGoogle(connectionId?: string) {
    startTransition(async () => {
      try {
        await disconnectGoogleCalendarFromWorkspaceAction({
          accountSlug,
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

  function disconnectProvider(provider: 'zoom' | 'teams') {
    startTransition(async () => {
      try {
        await disconnectConferencingAction({ accountSlug, provider });
        toast.success(
          provider === 'zoom' ? 'Zoom disconnected' : 'Teams disconnected',
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not disconnect conferencing account',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <AccountCard
          icon={<Calendar className="h-4 w-4" />}
          title="Google Calendar"
          description="Connect work and personal Google accounts for free/busy and Meet links."
          status={
            !google.configured
              ? 'unavailable'
              : google.connected
                ? 'connected'
                : 'disconnected'
          }
          detail={
            google.connected
              ? `${google.accountCount} Google account${google.accountCount === 1 ? '' : 's'} connected`
              : google.configured
                ? 'Connect to compute open slots accurately'
                : 'OAuth is not configured on this server yet'
          }
          action={
            canEdit && google.configured ? (
              google.connected ? (
                <Button
                  type="button"
                  size="sm"
                  className={`${workspaceBtnPrimaryMd} rounded-full`}
                  onClick={() => {
                    window.location.href = google.connectHref;
                  }}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Add Google account
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className={`${workspaceBtnPrimaryMd} rounded-full`}
                  onClick={() => {
                    window.location.href = google.connectHref;
                  }}
                >
                  Connect Google
                </Button>
              )
            ) : null
          }
        />

        <AccountCard
          icon={<Video className="h-4 w-4" />}
          title="Zoom"
          description="Creates Zoom meetings when an event type uses Zoom."
          status={
            !zoom.configured
              ? 'unavailable'
              : zoomConnection
                ? 'connected'
                : 'disconnected'
          }
          detail={
            zoomConnection?.providerAccountEmail ??
            (zoom.configured
              ? 'Connect a Zoom account for this workspace'
              : 'OAuth is not configured on this server yet')
          }
          action={
            canEdit && zoom.configured ? (
              zoomConnection ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={pending}
                  onClick={() => disconnectProvider('zoom')}
                >
                  <Unplug className="mr-2 h-3.5 w-3.5" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className={`${workspaceBtnPrimaryMd} rounded-full`}
                  onClick={() => {
                    window.location.href = zoom.connectHref;
                  }}
                >
                  Connect Zoom
                </Button>
              )
            ) : null
          }
        />

        <AccountCard
          icon={<Video className="h-4 w-4" />}
          title="Microsoft Teams"
          description="Creates Teams meetings when an event type uses Teams."
          status={
            !teams.configured
              ? 'unavailable'
              : teamsConnection
                ? 'connected'
                : 'disconnected'
          }
          detail={
            teamsConnection?.providerAccountEmail ??
            (teams.configured
              ? 'Connect a Teams account for this workspace'
              : 'OAuth is not configured on this server yet')
          }
          action={
            canEdit && teams.configured ? (
              teamsConnection ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={pending}
                  onClick={() => disconnectProvider('teams')}
                >
                  <Unplug className="mr-2 h-3.5 w-3.5" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className={`${workspaceBtnPrimaryMd} rounded-full`}
                  onClick={() => {
                    window.location.href = teams.connectHref;
                  }}
                >
                  Connect Teams
                </Button>
              )
            ) : null
          }
        />
      </div>

      {google.connected ? (
        <section
          className={`space-y-5 rounded-2xl border p-5 ${workspacePanelBorder}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">
                Google accounts & availability
              </h2>
              <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                Add your personal Google login as a second account. Booking
                slots avoid busy time across every connected account.
              </p>
            </div>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                className={`${workspaceBtnPrimaryMd} rounded-full`}
                disabled={pending}
                onClick={saveCalendarSelection}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Save calendars
              </Button>
            ) : null}
          </div>

          <div className="space-y-4">
            {google.accounts.map((account) => {
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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                        {account.email ?? 'Google account'}
                        {account.isPrimary ? (
                          <span
                            className={`ml-2 text-xs font-normal ${workspaceTextMuted}`}
                          >
                            Primary for Meet links
                          </span>
                        ) : null}
                      </p>
                      <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>
                        Tick calendars from this inbox that should block booking
                        slots.
                      </p>
                    </div>
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={pending}
                        onClick={() =>
                          setDisconnectTarget({
                            connectionId: account.connectionId,
                            email: account.email,
                          })
                        }
                      >
                        <Unplug className="mr-2 h-3.5 w-3.5" />
                        Disconnect
                      </Button>
                    ) : null}
                  </div>

                  {calendars.length === 0 ? (
                    <p className={`mt-3 text-sm ${workspaceTextMuted}`}>
                      No calendars returned for this account.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {calendars.map((calendar) => {
                        const busy = selection.busyCalendarIds.includes(
                          calendar.id,
                        );
                        const personal = selection.personalCalendarIds.includes(
                          calendar.id,
                        );
                        const key = `${account.connectionId}:${calendar.id}`;

                        return (
                          <div
                            key={key}
                            className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3"
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
                              <div className="mt-2 ml-7 flex items-center gap-2">
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
                                  className={`text-xs ${workspaceTextMuted}`}
                                >
                                  Treat as personal calendar
                                </Label>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
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
        onConfirm={() => disconnectGoogle(disconnectTarget?.connectionId)}
      />
    </div>
  );
}

function AccountCard({
  icon,
  title,
  description,
  status,
  detail,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: 'connected' | 'disconnected' | 'unavailable';
  detail: string;
  action: React.ReactNode;
}) {
  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'unavailable'
        ? 'Not configured'
        : 'Not connected';

  return (
    <div className={`rounded-2xl border p-5 ${workspacePanelBorder}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ozer-sky-100)]/20 text-[var(--ozer-info)]">
          {icon}
        </div>
        <Badge
          variant="outline"
          className={
            status === 'connected'
              ? 'rounded-full border-emerald-600/40 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'rounded-full'
          }
        >
          {statusLabel}
        </Badge>
      </div>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className={`mt-1 text-sm ${workspaceTextMuted}`}>{description}</p>
      <p className="mt-3 text-sm">{detail}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}
