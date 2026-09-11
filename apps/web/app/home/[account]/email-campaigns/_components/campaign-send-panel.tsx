'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { CampaignAnalyticsBundle } from '~/lib/campaigns/campaign-analytics';
import {
  AUDIENCE_TYPE_LABEL,
  CAMPAIGN_AUDIENCE_LIST_REQUIRED,
  campaignAudienceListMissing,
} from '~/lib/campaigns/campaign-audience';
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
import { CampaignRecipientLog } from './campaign-recipient-log';
import { CampaignSendTestDialog } from './campaign-send-test-dialog';
import { CampaignUpgradeCta } from './campaign-upgrade-cta';
import { CampaignUsageCard } from './campaign-usage-card';

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
}) {
  const router = useRouter();
  const editable =
    campaign.status === 'draft' || campaign.status === 'scheduled';
  const [scheduledTimezone, setScheduledTimezone] = useState(
    parseCampaignTimezone(campaign.scheduledTimezone),
  );
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendTestOpen, setSendTestOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const settingsHref = pathsConfig.app.accountEmailCampaignDetail
    .replace('[account]', accountSlug)
    .replace('[campaignId]', campaign.id);
  const contentHref = pathsConfig.app.accountEmailCampaignContent
    .replace('[account]', accountSlug)
    .replace('[campaignId]', campaign.id);
  const audiencesHref = pathsConfig.app.accountEmailCampaignAudiences.replace(
    '[account]',
    accountSlug,
  );
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
      <CampaignUsageCard
        snapshot={usage}
        accountSlug={accountSlug}
        fromEmail={campaign.fromEmail || brand.contact_email}
      />
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={settingsHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={contentHref}>Edit content</Link>
        </Button>
      </div>

      <div className={`${workspacePanelCard} space-y-3 p-4`}>
        <h3 className={`font-semibold ${workspaceText}`}>Send summary</h3>
        <p className={`text-sm ${workspaceTextMuted}`}>
          Audience: {AUDIENCE_TYPE_LABEL[campaign.audienceType]} ·{' '}
          <span data-test="campaign-send-audience-count">
            {audienceCount.toLocaleString()}
          </span>{' '}
          recipients · {usage.balance.toLocaleString()} send units left
        </p>
        <p className={`text-sm ${workspaceTextMuted}`}>From {fromLabel}</p>
        {campaign.replyTo ? (
          <p className={`text-sm ${workspaceTextMuted}`}>
            Reply-To {campaign.replyTo}
          </p>
        ) : null}
        {campaign.bodyDocument?.formLink ? (
          <p className={`text-sm ${workspaceTextMuted}`}>
            Form link: {campaign.bodyDocument.formLink.formName}
            {campaign.bodyDocument.formLink.prefillEmail
              ? ' (email prefilled per recipient)'
              : ''}
          </p>
        ) : null}
        {campaign.scheduledAt ? (
          <p className={`text-sm ${workspaceTextMuted}`}>
            Scheduled for{' '}
            {formatZonedInstant(
              campaign.scheduledAt,
              campaign.scheduledTimezone,
            )}
          </p>
        ) : null}

        {editable ? (
          <div className="flex flex-col gap-2 pt-2">
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
              disabled={pending || listAudienceIncomplete}
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
                Mark this occurrence Ready before it can send. Draft series
                instances never go out.
              </p>
            ) : null}
            <Button
              className={workspaceBtnPrimary}
              disabled={
                pending ||
                instanceBlocked ||
                listAudienceIncomplete ||
                insufficientSendUnits ||
                contactsBlocked ||
                audienceCount === 0
              }
              data-test="campaign-send"
              onClick={() => {
                startTransition(async () => {
                  try {
                    const result = await sendCampaignAction({
                      accountId,
                      accountSlug,
                      campaignId: campaign.id,
                    });
                    if ('success' in result && result.success === false) {
                      toast.error(result.message);
                      return;
                    }
                    toast.success(
                      result.remaining > 0
                        ? `Sending… ${result.remaining} left in the queue`
                        : 'Campaign sent',
                    );
                    router.refresh();
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : 'Could not send',
                    );
                  }
                });
              }}
            >
              {pending ? 'Working…' : 'Send now'}
            </Button>
            <div className="flex flex-wrap gap-2">
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={scheduledTimezone}
                disabled={pending}
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
                disabled={pending}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
              <Button
                variant="outline"
                disabled={pending || listAudienceIncomplete || !scheduledAt}
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
                disabled={pending}
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
        ) : (
          <p className={`text-sm ${workspaceTextMuted}`}>
            This campaign is {campaign.status}.
            {campaign.scheduledAt
              ? ` Scheduled for ${formatZonedInstant(campaign.scheduledAt, campaign.scheduledTimezone)}.`
              : ''}
          </p>
        )}
      </div>

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
