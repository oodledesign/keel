'use client';

import { type ReactNode, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';

import pathsConfig from '~/config/paths.config';
import type { CampaignAnalyticsBundle } from '~/lib/campaigns/campaign-analytics';
import {
  AUDIENCE_TYPE_LABEL,
  CAMPAIGN_AUDIENCE_LIST_REQUIRED,
  campaignAudienceListMissing,
} from '~/lib/campaigns/campaign-audience';
import type { CampaignLinkedFormSubmissions } from '~/lib/campaigns/campaign-form-submissions';
import {
  type CampaignSendProgressSnapshot,
  buildCampaignSendProgress,
} from '~/lib/campaigns/campaign-send-progress';
import { seriesInstanceMaySend } from '~/lib/campaigns/campaign-series-ready';
import {
  CAMPAIGN_TIMEZONES,
  formatZonedInstant,
  parseCampaignTimezone,
  timezoneShortLabel,
  zonedLocalToUtcIso,
} from '~/lib/campaigns/campaign-timezone';
import type { CampaignUsageSnapshot } from '~/lib/campaigns/campaign-usage';
import type {
  EmailCampaign,
  EmailCampaignRecipient,
} from '~/lib/campaigns/campaign.types';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  cancelScheduleCampaignAction,
  scheduleCampaignAction,
  sendCampaignAction,
  updateCampaignAction,
} from '../_lib/server/server-actions';
import { CampaignAnalyticsSummary } from './campaign-analytics-summary';
import type { AudiencePickerOption } from './campaign-audience-picker';
import { CampaignFormSubmissions } from './campaign-form-submissions';
import { CampaignRecipientLog } from './campaign-recipient-log';
import { CampaignSendProgress } from './campaign-send-progress';
import { CampaignSendTestDialog } from './campaign-send-test-dialog';
import { CampaignStatusBadge } from './campaign-status-badge';
import { CampaignUpgradeCta } from './campaign-upgrade-cta';

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
      <dt
        className={`w-28 shrink-0 text-xs font-medium tracking-wide uppercase ${workspaceTextMuted}`}
      >
        {label}
      </dt>
      <dd className={`min-w-0 text-sm ${workspaceText}`}>{children}</dd>
    </div>
  );
}

export function CampaignSendPanel({
  accountId,
  accountSlug,
  campaign,
  recipients,
  audienceCount,
  usage,
  analytics,
  brand,
  clients,
  linkedForm,
}: {
  accountId: string;
  accountSlug: string;
  campaign: EmailCampaign;
  recipients: EmailCampaignRecipient[];
  audienceCount: number;
  usage: CampaignUsageSnapshot;
  analytics: CampaignAnalyticsBundle;
  brand: { contact_email: string | null };
  clients: AudiencePickerOption[];
  linkedForm: CampaignLinkedFormSubmissions | null;
}) {
  const router = useRouter();
  const editable =
    campaign.status === 'draft' || campaign.status === 'scheduled';
  const [scheduledTimezone, setScheduledTimezone] = useState(
    parseCampaignTimezone(campaign.scheduledTimezone),
  );
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendTestOpen, setSendTestOpen] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [progressSeed, setProgressSeed] =
    useState<CampaignSendProgressSnapshot | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = pending || sendBusy;
  const showSendProgress = sendBusy || campaign.status === 'sending';

  const audiencesHref = pathsConfig.app.accountEmailCampaignAudiences.replace(
    '[account]',
    accountSlug,
  );
  const formHref = campaign.bodyDocument?.formLink
    ? `${pathsConfig.app.accountFormDetail
        .replace('[account]', accountSlug)
        .replace(
          '[formId]',
          campaign.bodyDocument.formLink.formId,
        )}?tab=submissions`
    : null;
  const listAudienceIncomplete = campaignAudienceListMissing(
    campaign.audienceType,
    campaign.audienceConfig,
  );

  const fromLabel = campaign.fromName?.trim()
    ? `${campaign.fromName.trim()} <${campaign.fromEmail || brand.contact_email || 'workspace'}>`
    : campaign.fromEmail || brand.contact_email || 'workspace default';

  const instanceBlocked = !seriesInstanceMaySend(campaign);
  const insufficientSendUnits =
    editable && audienceCount > 0 && usage.balance < audienceCount;
  const contactsBlocked =
    editable && usage.maxContacts > 0 && audienceCount > usage.maxContacts;

  return (
    <div className="space-y-6">
      <div className={`${workspacePanelCard} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className={`font-semibold ${workspaceText}`}>Send summary</h3>
            <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
              Review audience, sender, and status before you send.
            </p>
          </div>
          <CampaignStatusBadge status={campaign.status} />
        </div>

        <dl className="mt-4 divide-y divide-[color:var(--workspace-shell-border)] border-y border-[color:var(--workspace-shell-border)]">
          {campaign.status === 'failed' && campaign.lastError ? (
            <SummaryRow label="Error">{campaign.lastError}</SummaryRow>
          ) : null}
          <SummaryRow label="Audience">
            {AUDIENCE_TYPE_LABEL[campaign.audienceType]} ·{' '}
            <span data-test="campaign-send-audience-count">
              {audienceCount.toLocaleString()}
            </span>{' '}
            recipients
          </SummaryRow>
          <SummaryRow label="From">{fromLabel}</SummaryRow>
          {campaign.replyTo ? (
            <SummaryRow label="Reply-To">{campaign.replyTo}</SummaryRow>
          ) : null}
          {campaign.bodyDocument?.formLink ? (
            <SummaryRow label="Form">
              {formHref ? (
                <Link
                  href={formHref}
                  className="text-[var(--ozer-accent)] underline-offset-2 hover:underline"
                >
                  {campaign.bodyDocument.formLink.formName}
                </Link>
              ) : (
                campaign.bodyDocument.formLink.formName
              )}
              {campaign.bodyDocument.formLink.prefillEmail
                ? ' · email prefilled per recipient'
                : ''}
            </SummaryRow>
          ) : null}
          {campaign.scheduledAt ? (
            <SummaryRow label="Scheduled">
              {formatZonedInstant(
                campaign.scheduledAt,
                campaign.scheduledTimezone,
              )}
            </SummaryRow>
          ) : null}
        </dl>

        {showSendProgress ? (
          <div className="pt-4">
            <CampaignSendProgress
              accountId={accountId}
              campaignId={campaign.id}
              active={showSendProgress}
              initial={
                campaign.status === 'sending'
                  ? buildCampaignSendProgress({
                      status: campaign.status,
                      audienceCount: campaign.audienceCount || audienceCount,
                      sentCount: campaign.sentCount,
                      failedCount: campaign.failedCount,
                      skippedCount: campaign.skippedCount,
                      lastError: campaign.lastError,
                    })
                  : null
              }
              seed={progressSeed}
              expectedAudienceCount={audienceCount}
              onTerminal={() => {
                router.refresh();
              }}
            />
          </div>
        ) : null}

        {editable ? (
          <div className="flex flex-col gap-2 pt-4">
            {listAudienceIncomplete ? (
              <p
                className={`text-sm ${workspaceTextMuted}`}
                data-test="campaign-send-pick-list"
              >
                {CAMPAIGN_AUDIENCE_LIST_REQUIRED}.{' '}
                <Link
                  href={audiencesHref}
                  className="text-[var(--ozer-accent)] underline-offset-2 hover:underline"
                >
                  Create a list
                </Link>
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={busy || listAudienceIncomplete}
              data-test="campaign-send-test"
              onClick={() => setSendTestOpen(true)}
            >
              Send test
            </Button>
            <p className={`text-xs ${workspaceTextMuted}`}>
              Test emails are free and do not use send units.
            </p>
            <CampaignSendTestDialog
              open={sendTestOpen}
              onOpenChange={setSendTestOpen}
              accountId={accountId}
              accountSlug={accountSlug}
              campaignId={campaign.id}
              clients={clients}
              onBeforeSend={async () => {
                // Content/settings should already be saved; no-op keep hook.
              }}
            />
            {insufficientSendUnits || contactsBlocked ? (
              <CampaignUpgradeCta
                accountSlug={accountSlug}
                nextTierName={usage.nextTierName}
                message={
                  contactsBlocked
                    ? `This audience is ${audienceCount.toLocaleString()} contacts; the cap is ${usage.maxContacts.toLocaleString()}.`
                    : `Need ${audienceCount.toLocaleString()} send units, have ${usage.balance.toLocaleString()}.`
                }
              />
            ) : null}
            {instanceBlocked ? (
              <p
                className={`text-sm ${workspaceTextMuted}`}
                data-test="campaign-send-not-ready"
              >
                Send now is blocked until this week is Ready. Mark Ready on the
                planner, or confirm a schedule below — that also marks it Ready.
                Drafts never go out on their own.
              </p>
            ) : null}
            <Button
              className={workspaceBtnPrimary}
              disabled={
                busy ||
                instanceBlocked ||
                listAudienceIncomplete ||
                insufficientSendUnits ||
                contactsBlocked ||
                audienceCount === 0
              }
              data-test="campaign-send"
              onClick={() => {
                if (busy) {
                  return;
                }
                setSendBusy(true);
                startTransition(async () => {
                  try {
                    const result = await sendCampaignAction({
                      accountId,
                      accountSlug,
                      campaignId: campaign.id,
                    });
                    if ('success' in result && result.success === false) {
                      setSendBusy(false);
                      setProgressSeed(null);
                      toast.error(result.message);
                      return;
                    }
                    setProgressSeed(
                      buildCampaignSendProgress({
                        status: result.status,
                        audienceCount: result.audienceCount,
                        sentCount: result.sentCount,
                        failedCount: result.failedCount,
                        skippedCount: result.skippedCount,
                        lastError: null,
                      }),
                    );
                    toast.success(
                      result.remaining > 0
                        ? `Sending… ${result.remaining} left in the queue`
                        : 'Campaign sent',
                    );
                    router.refresh();
                  } catch (error) {
                    setSendBusy(false);
                    setProgressSeed(null);
                    toast.error(
                      error instanceof Error ? error.message : 'Could not send',
                    );
                  }
                });
              }}
            >
              {busy ? (
                <>
                  <Spinner className="mr-2 size-4 text-current" />
                  Sending…
                </>
              ) : (
                'Send now'
              )}
            </Button>
            <div className="flex flex-wrap gap-2">
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={scheduledTimezone}
                disabled={busy}
                onChange={(event) => setScheduledTimezone(event.target.value)}
              >
                {CAMPAIGN_TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {timezoneShortLabel(zone)}
                  </option>
                ))}
              </select>
              <Input
                type="datetime-local"
                value={scheduledAt}
                disabled={busy}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
              <Button
                variant="outline"
                disabled={busy || listAudienceIncomplete || !scheduledAt}
                data-test="campaign-schedule"
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await updateCampaignAction({
                        accountId,
                        accountSlug,
                        campaignId: campaign.id,
                        scheduledTimezone,
                      });
                      await scheduleCampaignAction({
                        accountId,
                        accountSlug,
                        campaignId: campaign.id,
                        scheduledAt: zonedLocalToUtcIso(
                          scheduledAt,
                          scheduledTimezone,
                        ),
                      });
                      toast.success('Campaign scheduled');
                      router.refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : 'Could not schedule',
                      );
                    }
                  });
                }}
              >
                Confirm schedule
              </Button>
            </div>
            {campaign.status === 'scheduled' ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await cancelScheduleCampaignAction({
                        accountId,
                        accountSlug,
                        campaignId: campaign.id,
                      });
                      toast.success('Schedule cancelled');
                      router.refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : 'Could not cancel',
                      );
                    }
                  });
                }}
              >
                Cancel schedule
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {linkedForm ? (
        <CampaignFormSubmissions
          accountId={accountId}
          accountSlug={accountSlug}
          campaignId={campaign.id}
          formId={linkedForm.formId}
          formName={linkedForm.formName}
          isRsvp={linkedForm.isRsvp}
          submissions={linkedForm.submissions}
        />
      ) : null}

      {campaign.status === 'sent' ||
      campaign.status === 'sending' ||
      recipients.length > 0 ? (
        <CampaignAnalyticsSummary
          campaign={campaign}
          analytics={analytics}
          planTier={usage.planTier}
          comparative={analytics.comparative}
        />
      ) : null}

      {recipients.length > 0 ? (
        <CampaignRecipientLog campaign={campaign} recipients={recipients} />
      ) : null}
    </div>
  );
}
