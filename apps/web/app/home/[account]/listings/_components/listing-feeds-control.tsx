'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { AlertTriangle, Rss } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  channelNeedsRightmoveResync,
  hasSwitchedOnChannels,
  switchedOnChannelsHaveIssue,
} from '~/lib/commercial/channel-publish-status';
import type { ListingFeedChannel } from '~/lib/commercial/listing-feed-channels';

import { republishRightmoveListingAction } from '../../commercial-publishing/_lib/server/server-actions';
import { useDisposalAccess } from './disposal-access-context';
import { ChannelStatusPill } from './listing-channel-status-pill';

export function ListingFeedsControl({
  channels,
  accountId,
  listingId,
}: {
  channels: ListingFeedChannel[];
  accountId: string;
  listingId: string;
}) {
  const router = useRouter();
  const { canEditDisposals } = useDisposalAccess();
  const [resyncPending, startResync] = useTransition();
  const statuses = channels.map((channel) => channel.status);
  const switchedOn = hasSwitchedOnChannels(statuses);
  const hasIssue = switchedOnChannelsHaveIssue(statuses);
  const needsRightmoveResync = channels.some((channel) =>
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

  const tone = !switchedOn
    ? 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)]'
    : hasIssue
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300'
      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-test="listing-feeds-control"
          data-sync-state={!switchedOn ? 'off' : hasIssue ? 'issue' : 'ok'}
          data-rightmove-out-of-sync={needsRightmoveResync ? 'true' : undefined}
          aria-label={
            hasIssue
              ? 'Feeds — one or more switched-on channels need attention'
              : switchedOn
                ? 'Feeds — switched-on channels are live and in sync'
                : 'Feeds — no channels are switched on'
          }
          className={cn(
            'relative inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
            'focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none',
            tone,
          )}
        >
          <Rss className="h-3.5 w-3.5" aria-hidden />
          Feeds
          {hasIssue ? (
            <AlertTriangle
              data-test="listing-feeds-warning"
              className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full bg-[var(--workspace-shell-panel)] p-px text-amber-500"
              aria-hidden
            />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-80 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 text-[var(--workspace-shell-text)]"
        data-test="listing-feeds-popover"
      >
        <p className="mb-2 text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          Feeds
        </p>
        <ul className="flex flex-wrap gap-2">
          {channels.map((channel) => (
            <li
              key={channel.key}
              data-test={`listing-feeds-row-${channel.key}`}
            >
              <ChannelStatusPill
                label={channel.label}
                status={channel.status}
              />
            </li>
          ))}
        </ul>
        {needsRightmoveResync ? (
          <p className="mt-3 text-xs text-[var(--workspace-shell-text-muted)]">
            Updates will sync to Rightmove shortly.
          </p>
        ) : null}
        {canEditDisposals && needsRightmoveResync ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={resyncPending}
            data-test="rightmove-out-of-sync"
            className="mt-2 h-8 px-2.5 text-xs"
            onClick={resyncRightmove}
          >
            {resyncPending ? 'Re-syncing…' : 'Re-sync Rightmove now'}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
