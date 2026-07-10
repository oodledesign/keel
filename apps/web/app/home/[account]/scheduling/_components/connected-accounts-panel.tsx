'use client';

import { useTransition } from 'react';

import { Calendar, Unplug, Video } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import {
  workspaceBtnPrimaryMd,
  workspacePanelBorder,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { disconnectGoogleCalendarFromWorkspaceAction } from '../../settings/_lib/server/task-automation-settings-actions';
import { disconnectConferencingAction } from '../_lib/server/scheduling-actions';
import type { ConferencingConnectionRow } from '../_lib/server/scheduling.service';

type Props = {
  accountSlug: string;
  canEdit: boolean;
  google: {
    configured: boolean;
    connected: boolean;
    connectHref: string;
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

export function ConnectedAccountsPanel({
  accountSlug,
  canEdit,
  google,
  zoom,
  teams,
  conferencing,
}: Props) {
  const [pending, startTransition] = useTransition();
  const zoomConnection = conferencing.find((item) => item.provider === 'zoom');
  const teamsConnection = conferencing.find(
    (item) => item.provider === 'teams',
  );

  function disconnectGoogle() {
    startTransition(async () => {
      try {
        await disconnectGoogleCalendarFromWorkspaceAction({ accountSlug });
        toast.success('Google Calendar disconnected');
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
    <div className="grid gap-4 md:grid-cols-3">
      <AccountCard
        icon={<Calendar className="h-4 w-4" />}
        title="Google Calendar"
        description="Used for free/busy checks and Meet links."
        status={
          !google.configured
            ? 'unavailable'
            : google.connected
              ? 'connected'
              : 'disconnected'
        }
        detail={
          google.connected
            ? 'Connected for this host account'
            : google.configured
              ? 'Connect to compute open slots accurately'
              : 'OAuth is not configured on this server yet'
        }
        action={
          canEdit && google.configured ? (
            google.connected ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={pending}
                onClick={disconnectGoogle}
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
        <Badge variant="outline" className="rounded-full">
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
