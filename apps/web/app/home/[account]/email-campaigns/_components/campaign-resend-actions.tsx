'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { EmailCampaign } from '~/lib/campaigns/campaign.types';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { duplicateCampaignForResendAction } from '../_lib/server/server-actions';

type ResendMode = 'all' | 'non_responders';

function followUpCopy(input: { mode: ResendMode; isSeriesInstance: boolean }): {
  title: string;
  description: string;
  action: string;
} {
  if (input.mode === 'non_responders') {
    return {
      title: 'Send to people who have not RSVP’d?',
      description: input.isSeriesInstance
        ? 'This creates a new one-off draft. The audience is everyone from this send who has not RSVP’d. The original send and the recurring series are not changed. Edit the copy, then review and send.'
        : 'This creates a new draft. The audience is everyone from this send who has not RSVP’d. The original sent campaign is not changed. Edit the copy, then review and send.',
      action: 'Create draft',
    };
  }

  return {
    title: 'Send this campaign again?',
    description: input.isSeriesInstance
      ? 'This creates a new one-off draft copied from this send, to the same people. The original send and the recurring series are not changed. Edit the copy, then review and send.'
      : 'This creates a new draft copied from this send, to the same people. The original sent campaign is not changed. Edit the copy, then review and send.',
    action: 'Create draft',
  };
}

export function CampaignResendActions({
  accountId,
  accountSlug,
  campaign,
  hasRsvpForm,
}: {
  accountId: string;
  accountSlug: string;
  campaign: EmailCampaign;
  hasRsvpForm: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ResendMode | null>(null);
  const [pending, startTransition] = useTransition();
  const canResend = campaign.status === 'sent' || campaign.status === 'failed';

  if (!canResend) return null;

  const copy = mode
    ? followUpCopy({
        mode,
        isSeriesInstance: Boolean(campaign.seriesId),
      })
    : null;

  const run = (nextMode: ResendMode) => {
    startTransition(async () => {
      try {
        const result = await duplicateCampaignForResendAction({
          accountId,
          accountSlug,
          campaignId: campaign.id,
          mode: nextMode,
        });
        toast.success('Draft created — edit the copy, then review and send');
        setMode(null);
        router.push(
          pathsConfig.app.accountEmailCampaignContent
            .replace('[account]', accountSlug)
            .replace('[campaignId]', result.campaignId),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create follow-up',
        );
      }
    });
  };

  return (
    <div
      className={`${workspacePanelCard} space-y-3 p-4`}
      data-test="campaign-resend-actions"
    >
      <div>
        <h3 className={`font-semibold ${workspaceText}`}>Send again</h3>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          Creates a new draft. This sent campaign stays as history.
          {campaign.seriesId
            ? ' The follow-up is a one-off — it is not added to the series.'
            : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className={workspaceBtnPrimary}
          disabled={pending}
          data-test="campaign-resend-all"
          onClick={() => setMode('all')}
        >
          Send again to all
        </Button>
        {hasRsvpForm ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            data-test="campaign-resend-non-responders"
            onClick={() => setMode('non_responders')}
          >
            Send to non-responders
          </Button>
        ) : null}
      </div>

      <AlertDialog
        open={Boolean(mode)}
        onOpenChange={(open) => {
          if (!pending && !open) setMode(null);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              className={workspaceBtnPrimary}
              disabled={pending || !mode}
              data-test="campaign-resend-confirm"
              onClick={(event) => {
                event.preventDefault();
                if (mode) run(mode);
              }}
            >
              {pending ? 'Creating…' : copy?.action}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
