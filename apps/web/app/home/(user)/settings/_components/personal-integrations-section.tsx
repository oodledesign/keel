'use client';

import { type ReactNode, useState, useTransition } from 'react';

import Link from 'next/link';

import { Calendar, ExternalLink, Loader2, Mail, Unplug } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import {
  DisconnectIntegrationDialog,
  GMAIL_DISCONNECT_CONSEQUENCES,
  GOOGLE_CALENDAR_DISCONNECT_CONSEQUENCES,
} from '~/components/integrations/disconnect-integration-dialog';
import pathsConfig from '~/config/paths.config';

import {
  disconnectGmailFromIntegrationsAction,
  disconnectGoogleCalendarAction,
} from '../_lib/server/personal-integrations-actions';
import type { PersonalIntegrationsData } from '../_lib/server/personal-integrations.loader';

type Props = {
  data: PersonalIntegrationsData;
};

function formatConnectedAt(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function IntegrationRow({
  icon,
  iconClassName,
  title,
  description,
  status,
  statusLabel,
  connectedDetail,
  featureHref,
  featureLabel,
  connectHref,
  onDisconnect,
  disconnecting,
  connectDisabled,
  connectDisabledReason,
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  description: string;
  status: 'connected' | 'disconnected' | 'unavailable';
  statusLabel: string;
  connectedDetail?: string | null;
  featureHref: string;
  featureLabel: string;
  connectHref: string;
  onDisconnect?: () => void;
  disconnecting?: boolean;
  connectDisabled?: boolean;
  connectDisabledReason?: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                {title}
              </h3>
              <Badge
                variant="outline"
                className={
                  status === 'connected'
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                    : status === 'unavailable'
                      ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                      : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]'
                }
              >
                {statusLabel}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              {description}
            </p>
            {connectedDetail ? (
              <p className="mt-1 text-sm text-[var(--workspace-shell-text)]">
                {connectedDetail}
              </p>
            ) : null}
            {connectDisabledReason ? (
              <p className="mt-2 text-xs text-amber-100/90">
                {connectDisabledReason}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {status === 'connected' && onDisconnect ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
              onClick={onDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting…
                </>
              ) : (
                <>
                  <Unplug className="mr-2 h-4 w-4" />
                  Disconnect
                </>
              )}
            </Button>
          ) : status !== 'unavailable' ? (
            <Button
              type="button"
              size="sm"
              className="ozer-gradient-btn text-[var(--ozer-white)]"
              disabled={connectDisabled}
              onClick={() => {
                window.location.href = connectHref;
              }}
            >
              Connect {title}
            </Button>
          ) : null}

          <Link
            href={featureHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ozer-accent)] hover:underline"
          >
            {featureLabel}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PersonalIntegrationsSection({ data }: Props) {
  const [pending, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState<
    'calendar' | 'gmail' | null
  >(null);
  const [confirmTarget, setConfirmTarget] = useState<
    'calendar' | 'gmail' | null
  >(null);

  const settingsReturnPath = encodeURIComponent(
    pathsConfig.app.personalAccountIntegrationsSettings,
  );

  const calendarConnectHref = `/api/integrations/google-calendar/start?returnPath=${settingsReturnPath}`;
  const gmailConnectHref = `/api/google/connect?returnPath=${settingsReturnPath}`;

  function confirmDisconnectCalendar() {
    setConfirmTarget(null);
    setDisconnecting('calendar');
    startTransition(async () => {
      try {
        const result = await disconnectGoogleCalendarAction();
        if (!result.success) {
          toast.error(result.error ?? 'Could not disconnect Google Calendar');
          return;
        }
        toast.success('Google Calendar disconnected');
      } finally {
        setDisconnecting(null);
      }
    });
  }

  function confirmDisconnectGmail() {
    setConfirmTarget(null);
    setDisconnecting('gmail');
    startTransition(async () => {
      try {
        const result = await disconnectGmailFromIntegrationsAction();
        if (!result.success) {
          toast.error(result.error ?? 'Could not disconnect Gmail');
          return;
        }
        toast.success('Gmail disconnected');
      } finally {
        setDisconnecting(null);
      }
    });
  }

  const calendarStatus = !data.calendar.configured
    ? 'unavailable'
    : data.calendar.connected
      ? 'connected'
      : 'disconnected';

  const gmailStatus = !data.gmail.configured
    ? 'unavailable'
    : data.gmail.connected
      ? 'connected'
      : 'disconnected';

  const gmailConnectDisabled =
    !data.gmail.emailAssistantAllowed && !data.gmail.connected;

  return (
    <div className="space-y-3">
      <IntegrationRow
        icon={<Calendar className="h-4 w-4" />}
        iconClassName="bg-[#4285F4]/15 text-[#8ab4f8]"
        title="Google Calendar"
        description="Powers Planner, public booking availability, and meeting titles in the desktop recorder."
        status={calendarStatus}
        statusLabel={
          calendarStatus === 'connected'
            ? data.calendar.accountCount > 1
              ? `${data.calendar.accountCount} accounts`
              : 'Connected'
            : calendarStatus === 'unavailable'
              ? 'Not configured'
              : 'Not connected'
        }
        connectedDetail={
          data.calendar.connected
            ? `${
                data.calendar.emails.length > 0
                  ? data.calendar.emails.join(' · ')
                  : 'Connected'
              }${
                formatConnectedAt(data.calendar.connectedAt)
                  ? ` · ${formatConnectedAt(data.calendar.connectedAt)}`
                  : ''
              }. Add another Google login from Scheduling → Connected accounts.`
            : data.calendar.configured
              ? 'Connect to include calendar events in your plans.'
              : 'Google Calendar OAuth is not configured on this server yet.'
        }
        featureHref={pathsConfig.app.personalPlanner}
        featureLabel="Open Planner"
        connectHref={calendarConnectHref}
        onDisconnect={
          data.calendar.connected
            ? () => setConfirmTarget('calendar')
            : undefined
        }
        disconnecting={disconnecting === 'calendar' || pending}
      />

      <IntegrationRow
        icon={<Mail className="h-4 w-4" />}
        iconClassName="bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]"
        title="Gmail"
        description="Powers inbox sync, reply drafts, and email assistant settings."
        status={gmailStatus}
        statusLabel={
          gmailStatus === 'connected'
            ? 'Connected'
            : gmailStatus === 'unavailable'
              ? 'Not configured'
              : 'Not connected'
        }
        connectedDetail={
          data.gmail.connected
            ? `${data.gmail.googleEmail ?? 'Connected'}${formatConnectedAt(data.gmail.connectedAt) ? ` · ${formatConnectedAt(data.gmail.connectedAt)}` : ''}`
            : data.gmail.configured
              ? 'Connect to sync threads and save drafts back to Gmail.'
              : 'Gmail OAuth is not configured on this server yet.'
        }
        featureHref={pathsConfig.app.personalEmailAssistant}
        featureLabel="Open Email"
        connectHref={gmailConnectHref}
        onDisconnect={
          data.gmail.connected ? () => setConfirmTarget('gmail') : undefined
        }
        disconnecting={disconnecting === 'gmail' || pending}
        connectDisabled={gmailConnectDisabled}
        connectDisabledReason={
          gmailConnectDisabled
            ? 'Email assistant add-on required. Upgrade in billing, then connect Gmail here or from the Email page.'
            : undefined
        }
      />

      {!data.gmail.emailAssistantAllowed ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Need the email assistant?{' '}
          <Link
            href={`${pathsConfig.app.personalAccountBilling}?addon=email-assistant`}
            className="font-medium text-[var(--ozer-accent)] hover:underline"
          >
            View billing
          </Link>
        </p>
      ) : null}

      <DisconnectIntegrationDialog
        open={confirmTarget === 'calendar'}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Disconnect Google Calendar?"
        description="This removes Ozer’s access to your Google Calendar account(s)."
        consequences={[...GOOGLE_CALENDAR_DISCONNECT_CONSEQUENCES]}
        confirming={disconnecting === 'calendar'}
        onConfirm={confirmDisconnectCalendar}
      />

      <DisconnectIntegrationDialog
        open={confirmTarget === 'gmail'}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Disconnect Gmail?"
        description="This removes Ozer’s access to this Gmail mailbox and deletes synced email data stored in Ozer."
        consequences={[...GMAIL_DISCONNECT_CONSEQUENCES]}
        confirming={disconnecting === 'gmail'}
        onConfirm={confirmDisconnectGmail}
      />
    </div>
  );
}
