'use client';

import { useMemo, useState, useSyncExternalStore, useTransition } from 'react';

import { Copy, Mail } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { copyTextToClipboard } from '~/lib/clipboard';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import {
  runCirculationDigest,
  setCirculationAutoSend,
  setCirculationContactAutoSend,
} from '../_lib/server/circulation-workspace-actions';

export type CirculationWorkspaceContact = {
  email: string;
  contactName: string | null;
  companyName: string | null;
  consentStatus: 'subscribed' | 'unsubscribed' | 'suppressed' | 'unknown';
  autoSendEnabled: boolean;
  lastDigestSentAt: string | null;
  matchCount: number;
  publicAccessToken: string | null;
};

export type CirculationWorkspaceSend = {
  id: string;
  subject: string;
  sendTrigger: string;
  sendKind: string;
  recipientCount: number;
  deliveredCount: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  complaintCount: number;
  createdAt: string;
  fromEmail: string | null;
  fromName: string | null;
  recipients: Array<{
    id: string;
    email: string;
    status: string;
    skipReason: string | null;
    errorMessage: string | null;
    sesMessageId: string | null;
    deliveredAt: string | null;
    openedAt: string | null;
    openCount: number;
    clickedAt: string | null;
    clickCount: number;
    bouncedAt: string | null;
    bounceType: string | null;
    complaintAt: string | null;
  }>;
};

type Props = {
  accountId: string;
  agencyName: string;
  fromEmail: string | null;
  fromName: string;
  initialAutoSendEnabled: boolean;
  initialContacts: CirculationWorkspaceContact[];
  initialSends: CirculationWorkspaceSend[];
};

function formatWhen(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function useBrowserOrigin() {
  return useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => '',
  );
}

function publicMatchesPath(token: string) {
  return `/share/matches/${token}`;
}

function publicMatchesHref(token: string, origin: string) {
  const path = publicMatchesPath(token);
  return origin ? `${origin}${path}` : path;
}

function statusLabel(contact: CirculationWorkspaceContact) {
  if (contact.consentStatus === 'unsubscribed') return 'Unsubscribed';
  if (contact.consentStatus === 'suppressed') return 'Suppressed';
  if (contact.consentStatus === 'unknown') return 'Not subscribed';
  if (!contact.autoSendEnabled) return 'Paused';
  return 'Auto-send on';
}

export function CirculationWorkspaceClient({
  accountId,
  agencyName,
  fromEmail,
  fromName,
  initialAutoSendEnabled,
  initialContacts,
  initialSends,
}: Props) {
  const [autoSend, setAutoSend] = useState(initialAutoSendEnabled);
  const [contacts, setContacts] = useState(initialContacts);
  const [sends] = useState(initialSends);
  const [autoPending, startAutoTransition] = useTransition();
  const [runPending, startRunTransition] = useTransition();
  const [contactPending, startContactTransition] = useTransition();
  const origin = useBrowserOrigin();

  const subscribedCount = useMemo(
    () => contacts.filter((c) => c.consentStatus === 'subscribed').length,
    [contacts],
  );

  function toggleGlobal(enabled: boolean) {
    const previous = autoSend;
    setAutoSend(enabled);
    startAutoTransition(async () => {
      try {
        await setCirculationAutoSend({ accountId, enabled });
        toast.success(
          enabled
            ? 'Automatic match emails are on'
            : 'Automatic match emails are paused',
        );
      } catch (error) {
        setAutoSend(previous);
        toast.error(
          error instanceof Error ? error.message : 'Could not update auto-send',
        );
      }
    });
  }

  function toggleContact(email: string, enabled: boolean) {
    const previous = contacts;
    setContacts((current) =>
      current.map((contact) =>
        contact.email === email
          ? {
              ...contact,
              autoSendEnabled: enabled,
              ...(enabled ? { consentStatus: 'subscribed' as const } : {}),
            }
          : contact,
      ),
    );
    startContactTransition(async () => {
      try {
        await setCirculationContactAutoSend({ accountId, email, enabled });
        toast.success(
          enabled
            ? 'Contact opted in for matching emails'
            : 'Automatic emails paused for this contact',
        );
      } catch (error) {
        setContacts(previous);
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update this contact',
        );
      }
    });
  }

  function run(dryRun: boolean) {
    startRunTransition(async () => {
      try {
        const result = await runCirculationDigest({ accountId, dryRun });
        toast.success(
          dryRun
            ? `Dry run: ${result.dryRunEligible} would be emailed`
            : `Sent ${result.mailed} digest${result.mailed === 1 ? '' : 's'}`,
        );
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not run circulation',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-[var(--workspace-shell-text)]">
            <Mail className="h-4 w-4" />
            Automatic match emails
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            When a disposal goes live, each matching person gets one email of
            every property that currently fits them — sent as {agencyName}, not
            Ozer. The daily cron is a safety net if a publish is missed.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
            <div>
              <p className="text-sm text-[var(--workspace-shell-text)]">
                Auto-send when a listing goes live
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                From {fromName}
                {fromEmail ? ` <${fromEmail}>` : ' — set Brand contact email'}
              </p>
            </div>
            <Switch
              checked={autoSend}
              disabled={autoPending}
              onCheckedChange={toggleGlobal}
              data-test="circulation-auto-send-switch"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className={workspaceBtnPrimaryMd}
              disabled={runPending || !fromEmail}
              onClick={() => run(false)}
              data-test="circulation-run-button"
            >
              {runPending ? 'Running…' : 'Send now'}
            </Button>
            <Button
              variant="outline"
              disabled={runPending || !fromEmail}
              onClick={() => run(true)}
              data-test="circulation-dry-run-button"
            >
              Dry run
            </Button>
          </div>
          {!fromEmail ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Add a contact email under Settings → Brand so SES can send as this
              workspace.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            People on the list
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-[var(--workspace-shell-text-muted)]">
            {subscribedCount} subscribed · {contacts.length} with current
            matches. Turn someone on to opt them into matching emails (only if
            you have a lawful basis). Pause keeps them subscribed without
            automatic emails.
          </p>
          {contacts.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              No matching applicants yet. Add requirements with emails, or
              publish the website requirement form.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
              {contacts.map((contact) => {
                const blocked =
                  contact.consentStatus === 'unsubscribed' ||
                  contact.consentStatus === 'suppressed';

                return (
                <li
                  key={contact.email}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {contact.contactName || contact.email}
                    </p>
                    <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                      {contact.email}
                      {contact.companyName ? ` · ${contact.companyName}` : ''}
                      {` · ${contact.matchCount} match${contact.matchCount === 1 ? '' : 'es'}`}
                      {` · Last sent ${formatWhen(contact.lastDigestSentAt)}`}
                      {` · ${statusLabel(contact)}`}
                    </p>
                    {contact.publicAccessToken ? (
                      <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
                        <span className="shrink-0">Public page</span>
                        <a
                          href={publicMatchesHref(
                            contact.publicAccessToken,
                            origin,
                          )}
                          target="_blank"
                          rel="noreferrer"
                          title={publicMatchesHref(
                            contact.publicAccessToken,
                            origin,
                          )}
                          className="min-w-0 truncate font-mono text-[var(--ozer-accent)] underline-offset-2 hover:underline"
                        >
                          /share/matches/
                          {contact.publicAccessToken.slice(0, 8)}…
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                          aria-label={`Copy public page link for ${contact.email}`}
                          onClick={() => {
                            const url = publicMatchesHref(
                              contact.publicAccessToken!,
                              origin ||
                                (typeof window !== 'undefined'
                                  ? window.location.origin
                                  : ''),
                            );
                            void copyTextToClipboard(url)
                              .then(() =>
                                toast.success('Public page link copied'),
                              )
                              .catch(() => toast.error('Could not copy link'));
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <Switch
                    checked={
                      contact.consentStatus === 'subscribed' &&
                      contact.autoSendEnabled
                    }
                    disabled={contactPending || blocked}
                    onCheckedChange={(enabled) =>
                      toggleContact(contact.email, enabled)
                    }
                    aria-label={`Auto-send for ${contact.email}`}
                  />
                </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Send log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sends.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              No circulation sends yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {sends.map((send) => (
                <li
                  key={send.id}
                  className="rounded-md border border-[color:var(--workspace-shell-border)] px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                      {send.subject}
                    </p>
                    <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                      {formatWhen(send.createdAt)} · {send.sendKind} ·{' '}
                      {send.sendTrigger} · {send.recipientCount} sent ·{' '}
                      {send.deliveredCount} delivered · {send.openCount} opens ·{' '}
                      {send.clickCount} clicks
                      {send.bounceCount ? ` · ${send.bounceCount} bounces` : ''}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {send.recipients.map((recipient) => (
                      <li
                        key={recipient.id}
                        className="text-xs text-[var(--workspace-shell-text-muted)]"
                      >
                        {recipient.email} · {recipient.status}
                        {recipient.skipReason
                          ? ` (${recipient.skipReason})`
                          : ''}
                        {recipient.deliveredAt ? ' · delivered' : ''}
                        {recipient.openedAt
                          ? ` · opened${recipient.openCount > 1 ? ` ×${recipient.openCount}` : ''}`
                          : ''}
                        {recipient.clickedAt
                          ? ` · clicked${recipient.clickCount > 1 ? ` ×${recipient.clickCount}` : ''}`
                          : ''}
                        {recipient.bouncedAt
                          ? ` · bounced${recipient.bounceType ? ` (${recipient.bounceType})` : ''}`
                          : ''}
                        {recipient.complaintAt ? ' · complaint' : ''}
                        {recipient.errorMessage
                          ? ` · ${recipient.errorMessage}`
                          : ''}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
