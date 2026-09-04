'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Eye, Mail, Send } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import {
  type CampaignAudienceConfig,
  type CampaignAudienceType,
  parseCampaignAudienceConfig,
} from '~/lib/campaigns/campaign-audience';
import type { EmailCampaign } from '~/lib/campaigns/campaign.types';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  cancelScheduleCampaignAction,
  scheduleCampaignAction,
  updateCampaignAction,
} from '../_lib/server/server-actions';
import {
  CampaignAudiencePicker,
  type AudiencePickerOption,
} from './campaign-audience-picker';
import {
  CampaignFromPicker,
  type CampaignSendingDomainOption,
} from './campaign-from-picker';

function toLocalInputValue(iso: string | null | undefined) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CampaignSettingsPanel({
  accountId,
  accountSlug,
  campaign,
  audienceCount,
  audienceOptions,
  brand,
  sendingDomain,
}: {
  accountId: string;
  accountSlug: string;
  campaign: EmailCampaign;
  audienceCount: number;
  audienceOptions: {
    clients: AudiencePickerOption[];
    contacts: AudiencePickerOption[];
    subscriberCount: number;
    clientCount: number;
    contactCount: number;
  };
  brand: { contact_email: string | null };
  sendingDomain: CampaignSendingDomainOption | null;
}) {
  const router = useRouter();
  const editable =
    campaign.status === 'draft' || campaign.status === 'scheduled';
  const [name, setName] = useState(campaign.name);
  const [subject, setSubject] = useState(campaign.subject);
  const [previewText, setPreviewText] = useState(campaign.previewText ?? '');
  const [fromName, setFromName] = useState(campaign.fromName ?? '');
  const [fromEmail, setFromEmail] = useState(() => {
    if (campaign.fromEmail) return campaign.fromEmail;
    if (sendingDomain?.verified) {
      return `${sendingDomain.defaultLocalPart}@${sendingDomain.sendingHost}`;
    }
    return '';
  });
  const [replyTo, setReplyTo] = useState(campaign.replyTo ?? '');
  const [audienceType, setAudienceType] = useState<CampaignAudienceType>(
    campaign.audienceType,
  );
  const [audienceConfig, setAudienceConfig] = useState<CampaignAudienceConfig>(
    () => parseCampaignAudienceConfig(campaign.audienceConfig),
  );
  const [scheduledAt, setScheduledAt] = useState(
    toLocalInputValue(campaign.scheduledAt),
  );
  const [pending, startTransition] = useTransition();

  const contentHref = pathsConfig.app.accountEmailCampaignContent
    .replace('[account]', accountSlug)
    .replace('[campaignId]', campaign.id);
  const sendHref = pathsConfig.app.accountEmailCampaignSend
    .replace('[account]', accountSlug)
    .replace('[campaignId]', campaign.id);

  const liveEstimate = useMemo(() => {
    if (audienceType === campaign.audienceType) {
      // Config may have changed locally; show server estimate as baseline.
      if (
        audienceType !== 'custom' ||
        JSON.stringify(audienceConfig) ===
          JSON.stringify(campaign.audienceConfig)
      ) {
        return audienceCount;
      }
    }
    if (audienceType === 'subscribers') return audienceOptions.subscriberCount;
    if (audienceType === 'clients') return audienceOptions.clientCount;
    if (audienceType === 'contacts') return audienceOptions.contactCount;
    const emails = audienceConfig.emails?.length ?? 0;
    const clients = audienceConfig.clientIds?.length ?? 0;
    const contacts = audienceConfig.contactIds?.length ?? 0;
    return emails + clients + contacts;
  }, [
    audienceType,
    audienceConfig,
    audienceCount,
    audienceOptions,
    campaign.audienceType,
    campaign.audienceConfig,
  ]);

  const saveSettings = () =>
    updateCampaignAction({
      accountId,
      accountSlug,
      campaignId: campaign.id,
      name,
      subject,
      previewText,
      fromName: fromName.trim() || null,
      fromEmail: fromEmail.trim() || null,
      replyTo: replyTo.trim() || null,
      audienceType,
      audienceConfig,
    });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="campaign-name">Internal name</Label>
          <Input
            id="campaign-name"
            value={name}
            disabled={!editable || pending}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="campaign-subject">Subject</Label>
          <Input
            id="campaign-subject"
            value={subject}
            disabled={!editable || pending}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="campaign-preview">Preview text</Label>
        <Input
          id="campaign-preview"
          value={previewText}
          disabled={!editable || pending}
          onChange={(event) => setPreviewText(event.target.value)}
        />
      </div>

      <div className={`${workspacePanelCard} space-y-3 p-4`}>
        <CampaignFromPicker
          sendingDomain={sendingDomain}
          fromName={fromName}
          fromEmail={fromEmail}
          replyTo={replyTo}
          disabled={!editable || pending}
          fallbackFromLabel={brand.contact_email}
          onFromNameChange={setFromName}
          onFromEmailChange={setFromEmail}
          onReplyToChange={setReplyTo}
        />
      </div>

      <CampaignAudiencePicker
        audienceType={audienceType}
        audienceConfig={audienceConfig}
        estimatedCount={liveEstimate}
        counts={audienceOptions}
        clients={audienceOptions.clients}
        contacts={audienceOptions.contacts}
        disabled={!editable || pending}
        onChange={({ audienceType: nextType, audienceConfig: nextConfig }) => {
          setAudienceType(nextType);
          setAudienceConfig(nextConfig);
        }}
      />

      <div className={`${workspacePanelCard} space-y-3 p-4`}>
        <h2 className={`font-semibold ${workspaceText}`}>Schedule</h2>
        <p className={`text-sm ${workspaceTextMuted}`}>
          Optional send time. You can also confirm from the Send page.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            type="datetime-local"
            value={scheduledAt}
            disabled={!editable || pending}
            onChange={(event) => setScheduledAt(event.target.value)}
            data-test="campaign-settings-schedule-input"
          />
          {editable ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={pending || !scheduledAt}
                data-test="campaign-settings-schedule"
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await saveSettings();
                      await scheduleCampaignAction({
                        accountId,
                        accountSlug,
                        campaignId: campaign.id,
                        scheduledAt: new Date(scheduledAt).toISOString(),
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
                Schedule
              </Button>
              {campaign.status === 'scheduled' ? (
                <Button
                  type="button"
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
                        setScheduledAt('');
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
            </>
          ) : null}
        </div>
        {campaign.status === 'scheduled' && campaign.scheduledAt ? (
          <p className={`text-sm ${workspaceTextMuted}`}>
            Currently scheduled for{' '}
            {new Date(campaign.scheduledAt).toLocaleString()}.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {editable ? (
          <Button
            variant="secondary"
            disabled={pending}
            data-test="campaign-settings-save"
            onClick={() => {
              startTransition(async () => {
                try {
                  await saveSettings();
                  toast.success('Settings saved');
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : 'Could not save',
                  );
                }
              });
            }}
          >
            Save settings
          </Button>
        ) : null}
        <Button asChild variant="outline" data-test="campaign-goto-content">
          <Link href={contentHref}>
            <Eye className="mr-2 h-4 w-4" />
            Edit content
          </Link>
        </Button>
        <Button asChild className={workspaceBtnPrimary} data-test="campaign-goto-send">
          <Link href={sendHref}>
            <Send className="mr-2 h-4 w-4" />
            Send
          </Link>
        </Button>
      </div>

      <p className={`flex items-center gap-2 text-xs ${workspaceTextMuted}`}>
        <Mail className="h-3.5 w-3.5" />
        Status: {campaign.status}
      </p>
    </div>
  );
}
