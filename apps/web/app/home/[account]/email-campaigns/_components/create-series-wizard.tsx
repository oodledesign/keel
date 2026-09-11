'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

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
import type {
  CampaignBrand,
  CampaignDocument,
} from '~/lib/campaigns/campaign-document';
import { SERIES_WEEKDAYS } from '~/lib/campaigns/campaign-recurrence';
import {
  CAMPAIGN_TIMEZONES,
  parseCampaignTimezone,
  timezoneShortLabel,
} from '~/lib/campaigns/campaign-timezone';
import type { CampaignAudienceList } from '~/lib/campaigns/campaign.types';
import type { CampaignTemplateWorkspace } from '~/lib/campaigns/templates';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { createCampaignSeriesAction } from '../_lib/server/campaign-series-actions';
import {
  type AudiencePickerOption,
  CampaignAudiencePicker,
} from './campaign-audience-picker';
import { CampaignTemplateGallery } from './campaign-template-gallery';

const STEPS = ['Recurrence', 'Audience', 'Content'] as const;

function todayYmd() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function CreateSeriesWizard({
  accountId,
  accountSlug,
  brand,
  workspace,
  audienceOptions,
  lists,
  planTier,
}: {
  accountId: string;
  accountSlug: string;
  brand: CampaignBrand;
  workspace: CampaignTemplateWorkspace;
  audienceOptions: {
    clients: AudiencePickerOption[];
    contacts: AudiencePickerOption[];
    subscriberCount: number;
    clientCount: number;
    contactCount: number;
  };
  lists: CampaignAudienceList[];
  planTier?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [name, setName] = useState('Friday update');
  const [timezone, setTimezone] = useState('Europe/London');
  const [weekday, setWeekday] = useState(5);
  const [sendHour, setSendHour] = useState(12);
  const [sendMinute, setSendMinute] = useState(0);
  const [startsOn, setStartsOn] = useState(todayYmd);
  const [generateAhead, setGenerateAhead] = useState(4);
  const [audienceType, setAudienceType] =
    useState<CampaignAudienceType>('subscribers');
  const [audienceConfig, setAudienceConfig] = useState<CampaignAudienceConfig>(
    () => parseCampaignAudienceConfig({}),
  );
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [bodyDocument, setBodyDocument] = useState<
    CampaignDocument | undefined
  >();

  const estimatedCount = useMemo(() => {
    if (audienceType === 'subscribers') return audienceOptions.subscriberCount;
    if (audienceType === 'clients') return audienceOptions.clientCount;
    if (audienceType === 'contacts') return audienceOptions.contactCount;
    if (audienceType === 'list') return 0;
    return (
      (audienceConfig.emails?.length ?? 0) +
      (audienceConfig.clientIds?.length ?? 0) +
      (audienceConfig.contactIds?.length ?? 0)
    );
  }, [audienceConfig, audienceOptions, audienceType]);

  function submit() {
    startTransition(async () => {
      try {
        const result = await createCampaignSeriesAction({
          accountId,
          accountSlug,
          name,
          timezone: parseCampaignTimezone(timezone),
          recurrenceByWeekday: weekday,
          sendHour,
          sendMinute,
          startsOn,
          generateAhead,
          audienceType,
          audienceConfig,
          subject,
          previewText,
          bodyDocument,
        });
        router.push(
          pathsConfig.app.accountEmailCampaignSeriesDetail
            .replace('[account]', accountSlug)
            .replace('[seriesId]', result.seriesId),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create series',
        );
      }
    });
  }

  return (
    <div className={`${workspacePanelCard} space-y-6 p-5`}>
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={index === step ? workspaceText : workspaceTextMuted}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="series-name">Series name</Label>
            <Input
              id="series-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="series-weekday">Sends on</Label>
            <select
              id="series-weekday"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={weekday}
              onChange={(event) => setWeekday(Number(event.target.value))}
            >
              {SERIES_WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="series-hour">Hour</Label>
              <Input
                id="series-hour"
                type="number"
                min={0}
                max={23}
                value={sendHour}
                onChange={(event) => setSendHour(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="series-minute">Minute</Label>
              <Input
                id="series-minute"
                type="number"
                min={0}
                max={59}
                value={sendMinute}
                onChange={(event) => setSendMinute(Number(event.target.value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="series-timezone">Timezone</Label>
            <select
              id="series-timezone"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            >
              {CAMPAIGN_TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {timezoneShortLabel(zone)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="series-starts">Starts on</Label>
            <Input
              id="series-starts"
              type="date"
              value={startsOn}
              onChange={(event) => setStartsOn(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="series-ahead">Generate ahead</Label>
            <Input
              id="series-ahead"
              type="number"
              min={1}
              max={12}
              value={generateAhead}
              onChange={(event) => setGenerateAhead(Number(event.target.value))}
            />
            <p className={`text-xs ${workspaceTextMuted}`}>
              Keep this many upcoming drafts ready to edit. Default 4.
            </p>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <CampaignAudiencePicker
          accountSlug={accountSlug}
          audienceType={audienceType}
          audienceConfig={audienceConfig}
          estimatedCount={estimatedCount}
          counts={audienceOptions}
          clients={audienceOptions.clients}
          contacts={audienceOptions.contacts}
          lists={lists}
          planTier={planTier}
          onChange={(next) => {
            setAudienceType(next.audienceType);
            setAudienceConfig(next.audienceConfig);
          }}
        />
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="series-subject">Baseline subject</Label>
            <Input
              id="series-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="This week at the studio"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="series-preview">Preview text</Label>
            <Input
              id="series-preview"
              value={previewText}
              onChange={(event) => setPreviewText(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setGalleryOpen(true)}
            >
              {bodyDocument ? 'Change template' : 'Pick a template'}
            </Button>
            <p className={`text-sm ${workspaceTextMuted}`}>
              Each week starts from this baseline. Edit that occurrence before
              marking it Ready.
            </p>
          </div>
          <CampaignTemplateGallery
            open={galleryOpen}
            onOpenChange={setGalleryOpen}
            brand={brand}
            workspace={workspace}
            onSelect={({ template, document }) => {
              setBodyDocument(document);
              if (!subject.trim()) setSubject(template.subject);
              if (!previewText.trim()) setPreviewText(template.previewText);
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || pending}
          onClick={() => setStep((value) => Math.max(0, value - 1))}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            className={workspaceBtnPrimary}
            disabled={!name.trim()}
            onClick={() => setStep((value) => value + 1)}
          >
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            className={workspaceBtnPrimary}
            disabled={pending || !name.trim()}
            data-test="series-create"
            onClick={submit}
          >
            {pending ? 'Creating…' : 'Create series'}
          </Button>
        )}
      </div>
    </div>
  );
}
