'use client';

import { useMemo, useState, useSyncExternalStore, useTransition } from 'react';

import { Copy, Mail } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { copyTextToClipboard } from '~/lib/clipboard';
import type { CirculationUsageSnapshot } from '~/lib/commercial/circulation/circulation-usage-types';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import {
  dismissCirculationUnsubscribeReview,
  runCirculationDigest,
  setCirculationAutoSend,
  setCirculationContactAutoSend,
  setCirculationMinGap,
  setCirculationRematch,
} from '../_lib/server/circulation-workspace-actions';

export type CirculationWorkspaceContact = {
  email: string;
  contactName: string | null;
  companyName: string | null;
  consentStatus: 'subscribed' | 'unsubscribed' | 'suppressed' | 'unknown';
  autoSendEnabled: boolean;
  lastCirculatedAt: string | null;
  matchCount: number;
  publicAccessToken: string | null;
};

export type CirculationSuspectedUnsubscribe = {
  email: string;
  unsubscribedAt: string;
  sentAt: string;
  secondsAfterSend: number;
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
  initialMinGapDays: number;
  initialRematchOnPriceDrop: boolean;
  initialRematchOnRelist: boolean;
  initialContacts: CirculationWorkspaceContact[];
  initialSends: CirculationWorkspaceSend[];
  suspectedUnsubscribes: CirculationSuspectedUnsubscribe[];
  usage?: CirculationUsageSnapshot;
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
  initialMinGapDays,
  initialRematchOnPriceDrop,
  initialRematchOnRelist,
  initialContacts,
  initialSends,
  suspectedUnsubscribes,
  usage,
}: Props) {
  const [autoSend, setAutoSend] = useState(initialAutoSendEnabled);
  const [minGapDays, setMinGapDays] = useState(initialMinGapDays);
  const [minGapDraft, setMinGapDraft] = useState(String(initialMinGapDays));
  const [rematchOnPriceDrop, setRematchOnPriceDrop] = useState(
    initialRematchOnPriceDrop,
  );
  const [rematchOnRelist, setRematchOnRelist] = useState(
    initialRematchOnRelist,
  );
  const [contacts, setContacts] = useState(initialContacts);
  const [sends] = useState(initialSends);
  const [suspects, setSuspects] = useState(suspectedUnsubscribes);
  const [autoPending, startAutoTransition] = useTransition();
  const [gapPending, startGapTransition] = useTransition();
  const [rematchPending, startRematchTransition] = useTransition();
  const [runPending, startRunTransition] = useTransition();
  const [contactPending, startContactTransition] = useTransition();
  const [reviewPending, startReviewTransition] = useTransition();
  const origin = useBrowserOrigin();

  function saveMinGap() {
    const parsed = Number.parseInt(minGapDraft, 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 60) {
      setMinGapDraft(String(minGapDays));
      toast.error('Enter a gap between 0 and 60 days');
      return;
    }
    if (parsed === minGapDays) return;

    const previous = minGapDays;
    setMinGapDays(parsed);
    setMinGapDraft(String(parsed));
    startGapTransition(async () => {
      try {
        await setCirculationMinGap({ accountId, minGapDays: parsed });
        toast.success(
          parsed === 0
            ? 'No minimum gap between automatic emails'
            : `At most one automatic email every ${parsed} day${parsed === 1 ? '' : 's'}`,
        );
      } catch (error) {
        setMinGapDays(previous);
        setMinGapDraft(String(previous));
        toast.error(
          error instanceof Error ? error.message : 'Could not update the gap',
        );
      }
    });
  }

  function toggleRematch(kind: 'onPriceDrop' | 'onRelist', enabled: boolean) {
    const setValue =
      kind === 'onPriceDrop' ? setRematchOnPriceDrop : setRematchOnRelist;
    const previous =
      kind === 'onPriceDrop' ? rematchOnPriceDrop : rematchOnRelist;
    setValue(enabled);
    startRematchTransition(async () => {
      try {
        await setCirculationRematch({ accountId, [kind]: enabled });
        toast.success(enabled ? 'Setting turned on' : 'Setting turned off');
      } catch (error) {
        setValue(previous);
        toast.error(
          error instanceof Error ? error.message : 'Could not update setting',
        );
      }
    });
  }

  function dismissSuspect(email: string) {
    const previous = suspects;
    setSuspects((current) => current.filter((row) => row.email !== email));
    startReviewTransition(async () => {
      try {
        await dismissCirculationUnsubscribeReview({ accountId, email });
      } catch (error) {
        setSuspects(previous);
        toast.error(
          error instanceof Error ? error.message : 'Could not dismiss',
        );
      }
    });
  }

  function copyResubscribeLink(token: string) {
    const url = publicMatchesHref(token, origin || window.location.origin);
    void copyTextToClipboard(url)
      .then(() => toast.success('Preferences link copied'))
      .catch(() => toast.error('Could not copy link'));
  }

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
        const nothingNew = result.nothingNew
          ? ` · ${result.nothingNew} with nothing new`
          : '';
        toast.success(
          dryRun
            ? `Dry run: ${result.dryRunEligible} would be emailed${nothingNew}`
            : `Sent ${result.mailed} digest${result.mailed === 1 ? '' : 's'}${nothingNew}`,
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
      {usage ? (
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Commercial circulation allowance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Separate from Campaigns credits. Included stub: 250 contacts and
              1,000 emails / month. Packs can follow later.
            </p>
            <p className="mt-2 text-sm text-[var(--workspace-shell-text)]">
              {usage.contactsUsed.toLocaleString()} /{' '}
              {usage.maxContacts.toLocaleString()} contacts ·{' '}
              {usage.emailsSent.toLocaleString()} /{' '}
              {usage.monthlyAllowance.toLocaleString()} emails this month
              {usage.cycleEnd ? ` · cycle ends ${usage.cycleEnd}` : ''}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-[var(--workspace-shell-text)]">
            <Mail className="h-4 w-4" />
            Automatic match emails
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            When a disposal goes live, matching people get one email leading
            with properties they haven&apos;t been sent yet — sent as{' '}
            {agencyName}, not Ozer. Nobody is emailed unless something is new.
            The daily run catches anyone held back by the gap below.
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
            <div>
              <p className="text-sm text-[var(--workspace-shell-text)]">
                Minimum gap between automatic emails
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Per contact. &quot;Send now&quot; ignores the gap but still only
                emails people with something new.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                value={minGapDraft}
                disabled={gapPending}
                onChange={(event) => setMinGapDraft(event.target.value)}
                onBlur={saveMinGap}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
                className="h-8 w-16 text-right tabular-nums"
                aria-label="Minimum days between automatic emails"
                data-test="circulation-min-gap-input"
              />
              <span className="text-sm text-[var(--workspace-shell-text-muted)]">
                days
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
            <div>
              <p className="text-sm text-[var(--workspace-shell-text)]">
                Re-send when the price drops
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                A cut of 5% or more on a listing someone was already sent, in
                the daily run. Marked &quot;Price reduced&quot;. A price put
                back up cancels it.
              </p>
            </div>
            <Switch
              checked={rematchOnPriceDrop}
              disabled={rematchPending}
              onCheckedChange={(enabled) =>
                toggleRematch('onPriceDrop', enabled)
              }
              data-test="circulation-rematch-price-drop-switch"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
            <div>
              <p className="text-sm text-[var(--workspace-shell-text)]">
                Re-send when a listing is back on the market
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Under offer, let, sold or withdrawn, then marketing again.
                Marked &quot;Back on the market&quot;.
              </p>
            </div>
            <Switch
              checked={rematchOnRelist}
              disabled={rematchPending}
              onCheckedChange={(enabled) => toggleRematch('onRelist', enabled)}
              data-test="circulation-rematch-relist-switch"
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

      {suspects.length > 0 ? (
        <Card
          className={workspacePanelCard}
          data-test="circulation-suspected-unsubscribes"
        >
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Unsubscribes to review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-[var(--workspace-shell-text-muted)]">
              These people were unsubscribed seconds after an email arrived and
              never engaged with any other email. That usually means a
              company&apos;s link scanner opened the old unsubscribe link, not
              the person. They stay unsubscribed. If you think it was a scanner,
              send them their preferences link so they can resubscribe
              themselves.
            </p>
            <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
              {suspects.map((suspect) => (
                <li
                  key={suspect.email}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {suspect.email}
                    </p>
                    <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Unsubscribed {suspect.secondsAfterSend}s after the email
                      sent · {formatWhen(suspect.unsubscribedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {suspect.publicAccessToken ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyResubscribeLink(suspect.publicAccessToken!)
                        }
                      >
                        <Copy className="mr-1.5 h-3 w-3" />
                        Copy preferences link
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={reviewPending}
                      onClick={() => dismissSuspect(suspect.email)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

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
                        {` · Last sent ${formatWhen(contact.lastCirculatedAt)}`}
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
                                .catch(() =>
                                  toast.error('Could not copy link'),
                                );
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
