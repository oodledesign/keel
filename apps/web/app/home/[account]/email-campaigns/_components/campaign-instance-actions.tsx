'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { recurringInstanceStatus } from '~/lib/campaigns/campaign-series-ready';
import type { EmailCampaignStatus } from '~/lib/campaigns/campaign.types';

import {
  markCampaignInstanceReadyAction,
  markCampaignInstanceUnreadyAction,
  skipCampaignInstanceAction,
} from '../_lib/server/campaign-series-actions';

export function CampaignInstanceActions({
  accountId,
  accountSlug,
  seriesId,
  campaignId,
  status,
  ready,
  compact,
}: {
  accountId: string;
  accountSlug: string;
  seriesId: string;
  campaignId: string;
  status: EmailCampaignStatus | string;
  ready: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const plannerStatus = recurringInstanceStatus({ status, ready });
  const canEdit =
    plannerStatus === 'draft' ||
    plannerStatus === 'ready' ||
    plannerStatus === 'scheduled';

  if (!canEdit) return null;

  const payload = {
    accountId,
    accountSlug,
    seriesId,
    campaignId,
  };

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? '' : 'pt-1'}`}>
      {plannerStatus === 'draft' ? (
        <Button
          size="sm"
          disabled={pending}
          data-test="campaign-instance-ready"
          onClick={() => {
            startTransition(async () => {
              try {
                await markCampaignInstanceReadyAction(payload);
                toast.success(
                  'Marked ready — it will send at the scheduled time',
                );
                router.refresh();
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : 'Could not mark ready',
                );
              }
            });
          }}
        >
          Mark ready
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          data-test="campaign-instance-unready"
          onClick={() => {
            startTransition(async () => {
              try {
                await markCampaignInstanceUnreadyAction(payload);
                toast.success('Moved back to draft — it will not send');
                router.refresh();
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : 'Could not unready',
                );
              }
            });
          }}
        >
          Unready
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        data-test="campaign-instance-skip"
        onClick={() => {
          startTransition(async () => {
            try {
              await skipCampaignInstanceAction(payload);
              toast.success('Skipped this occurrence');
              router.refresh();
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : 'Could not skip',
              );
            }
          });
        }}
      >
        Skip
      </Button>
    </div>
  );
}
