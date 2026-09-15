'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import {
  type ChannelPublishStatus,
  channelNeedsRightmoveResync,
  hasSwitchedOnChannels,
  switchedOnChannelsHaveIssue,
} from '~/lib/commercial/channel-publish-status';

import { republishRightmoveListingAction } from '../../commercial-publishing/_lib/server/server-actions';
import { useDisposalAccess } from './disposal-access-context';

export type ListingChannelSyncRow = {
  key: string;
  label: string;
  status: ChannelPublishStatus;
};

export function ListingChannelSyncIcon({
  channels,
  accountId,
  listingId,
}: {
  channels: ListingChannelSyncRow[];
  accountId: string;
  listingId: string;
}) {
  const router = useRouter();
  const { canEditDisposals } = useDisposalAccess();
  const [resyncPending, startResync] = useTransition();
  const switchedOn = channels.filter((channel) => channel.status.switchOn);

  if (!hasSwitchedOnChannels(channels.map((channel) => channel.status))) {
    return null;
  }

  const hasIssue = switchedOnChannelsHaveIssue(
    channels.map((channel) => channel.status),
  );
  const needsRightmoveResync = switchedOn.some((channel) =>
    channelNeedsRightmoveResync(channel.key, channel.status),
  );

  const resyncRightmove = () => {
    startResync(async () => {
      try {
        await republishRightmoveListingAction({
          accountId,
          listingId,
        });
        toast.success('Rightmove re-sync sent');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not re-sync Rightmove',
        );
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-test="channel-sync-icon"
              data-sync-state={hasIssue ? 'issue' : 'ok'}
              data-rightmove-out-of-sync={
                needsRightmoveResync ? 'true' : undefined
              }
              aria-label={
                hasIssue
                  ? 'Channel sync issues — hover for details'
                  : 'All switched-on channels are live and in sync'
              }
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none',
                hasIssue
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-300'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-300',
              )}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="end"
            className="max-w-xs border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 text-[var(--workspace-shell-text)] shadow-md"
          >
            <p className="mb-2 text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              Switched-on channels
            </p>
            <ul className="space-y-2" data-test="channel-sync-tooltip">
              {switchedOn.map((channel) => (
                <li
                  key={channel.key}
                  className="min-w-0"
                  data-test={`channel-sync-row-${channel.key}`}
                >
                  <p className="text-xs font-medium">{channel.label}</p>
                  <p
                    className={cn(
                      'text-xs',
                      channel.status.outOfSync ||
                        channel.status.state === 'blocked'
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-[var(--workspace-shell-text-muted)]',
                    )}
                  >
                    {channel.status.label}
                    {channel.status.detail ? ` — ${channel.status.detail}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {canEditDisposals && needsRightmoveResync ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={resyncPending}
          data-test="rightmove-out-of-sync"
          className="h-8 px-2.5 text-xs"
          onClick={resyncRightmove}
        >
          {resyncPending ? 'Re-syncing…' : 'Re-sync Rightmove'}
        </Button>
      ) : null}
    </div>
  );
}
