'use client';

import { Globe, Radio } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import { RightmovePublicationStatusBadge } from '~/components/commercial/rightmove-publication-status-badge';
import {
  type FeedListSyncStatus,
  feedListSyncBadgeClass,
  feedListSyncTitle,
  formatFeedListSyncStatus,
} from '~/lib/commercial/listing-feed-list-status';
import {
  type RightmoveListSyncStatus,
  formatRightmoveListSyncStatus,
} from '~/lib/commercial/rightmove-publish-status';

import type { CommercialListing } from '../_lib/server/listings.service';

type FeedChannel = 'website' | 'each';

function feedStatusToneClass(status: FeedListSyncStatus | undefined) {
  if (status === 'live') {
    return 'text-emerald-700 dark:text-emerald-300';
  }
  if (status === 'blocked') {
    return 'text-amber-700 dark:text-amber-300';
  }
  if (status === 'error') {
    return 'text-rose-700 dark:text-rose-300';
  }
  return 'text-[var(--workspace-shell-text)]/40';
}

function rightmoveStatusToneClass(status: RightmoveListSyncStatus | undefined) {
  if (status === 'pushed') {
    return 'text-emerald-700 dark:text-emerald-300';
  }
  if (status === 'unsynced' || status === 'not_pushed' || status === 'draft') {
    return 'text-amber-700 dark:text-amber-300';
  }
  if (status === 'failed') {
    return 'text-rose-700 dark:text-rose-300';
  }
  return 'text-[var(--workspace-shell-text)]/40';
}

function ListingFeedSyncBadge({
  channel,
  status,
}: {
  channel: FeedChannel;
  status?: FeedListSyncStatus;
}) {
  if (!status) {
    return (
      <span className="text-[var(--workspace-shell-text)]/35" aria-hidden>
        —
      </span>
    );
  }

  const label = formatFeedListSyncStatus(channel, status);
  const title = feedListSyncTitle(channel, status);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        feedListSyncBadgeClass(channel, status),
      )}
      title={title}
      data-test={`${channel}-status-pill-${label.toLowerCase()}`}
    >
      {label}
    </span>
  );
}

function ListingFeedSyncIcon({
  channel,
  status,
}: {
  channel: FeedChannel;
  status?: FeedListSyncStatus;
}) {
  const title = feedListSyncTitle(channel, status);
  const Icon = channel === 'website' ? Globe : Radio;

  return (
    <span
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md',
        feedStatusToneClass(status),
      )}
      title={title}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

function ListingRightmoveSyncBadge({
  listing,
}: {
  listing: CommercialListing;
}) {
  if (!listing.rightmoveSyncStatus) {
    return (
      <span className="text-[var(--workspace-shell-text)]/35" aria-hidden>
        —
      </span>
    );
  }

  return (
    <RightmovePublicationStatusBadge status={listing.rightmoveSyncStatus} />
  );
}

export function ListingListFeedStatusCells({
  listing,
}: {
  listing: CommercialListing;
}) {
  const websiteTitle = feedListSyncTitle('website', listing.websiteSyncStatus);
  const eachTitle = feedListSyncTitle('each', listing.eachSyncStatus);
  const rightmoveTitle = listing.rightmoveSyncStatus
    ? `Rightmove: ${formatRightmoveListSyncStatus(listing.rightmoveSyncStatus)}`
    : 'Rightmove status unavailable';

  return (
    <>
      <td className="px-2 py-3 xl:hidden">
        <TooltipProvider delayDuration={200}>
          <div
            className="flex items-center gap-0.5"
            data-test="disposal-feed-sync"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="rounded-md focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none"
                  aria-label={websiteTitle}
                  data-test={`disposal-website-sync-icon-${listing.websiteSyncStatus ?? 'unknown'}`}
                >
                  <ListingFeedSyncIcon
                    channel="website"
                    status={listing.websiteSyncStatus}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {websiteTitle}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="rounded-md focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none"
                  aria-label={eachTitle}
                  data-test={`disposal-each-sync-icon-${listing.eachSyncStatus ?? 'unknown'}`}
                >
                  <ListingFeedSyncIcon
                    channel="each"
                    status={listing.eachSyncStatus}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {eachTitle}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none',
                    rightmoveStatusToneClass(listing.rightmoveSyncStatus),
                  )}
                  title={rightmoveTitle}
                  aria-label={rightmoveTitle}
                  data-test={`disposal-rightmove-sync-icon-${listing.rightmoveSyncStatus ?? 'unknown'}`}
                >
                  R
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {rightmoveTitle}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </td>
      <td
        className="hidden px-4 py-3 xl:table-cell"
        data-test={`disposal-website-sync-${listing.websiteSyncStatus ?? 'unknown'}`}
      >
        <ListingFeedSyncBadge
          channel="website"
          status={listing.websiteSyncStatus}
        />
      </td>
      <td
        className="hidden px-4 py-3 xl:table-cell"
        data-test={`disposal-each-sync-${listing.eachSyncStatus ?? 'unknown'}`}
      >
        <ListingFeedSyncBadge channel="each" status={listing.eachSyncStatus} />
      </td>
      <td
        className="hidden px-4 py-3 xl:table-cell"
        data-test={`disposal-rightmove-sync-${listing.rightmoveSyncStatus ?? 'unknown'}`}
      >
        <ListingRightmoveSyncBadge listing={listing} />
      </td>
    </>
  );
}

export function ListingListFeedStatusHeaders() {
  return (
    <>
      <th
        className="px-2 py-3 font-medium xl:hidden"
        title="Website, EACH, and Rightmove status"
      >
        Feeds
      </th>
      <th
        className="hidden px-4 py-3 font-medium xl:table-cell"
        title="Website XML feed status"
      >
        Website
      </th>
      <th
        className="hidden px-4 py-3 font-medium xl:table-cell"
        title="EACH feed status"
      >
        EACH
      </th>
      <th
        className="hidden px-4 py-3 font-medium xl:table-cell"
        title="Rightmove sync status"
      >
        Rightmove
      </th>
    </>
  );
}
