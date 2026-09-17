'use client';

import { useMemo } from 'react';

import { Rss } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import {
  buildListingFeedChannels,
  listingCardFeedChannels,
  listingCardFeedsHaveIssue,
} from '~/lib/commercial/listing-feed-channels';

import type { CommercialListing } from '../_lib/server/listings.service';
import { ListingFeedsOverview } from './listing-feeds-overview';

export function ListingCardFeedsIcon({
  listing,
  accountSlug,
  className,
}: {
  listing: CommercialListing;
  accountSlug: string;
  className?: string;
}) {
  const channels = useMemo(() => {
    // List cards omit websitePublicPageUrl / websiteUrlHealth — those are
    // resolved on the disposal detail page. Website therefore shows Live
    // here even when the public URL is still pending or broken.
    return buildListingFeedChannels({
      listing,
      accountSlug,
      publications: listing.feedPublications ?? [],
      mediaCreatedAt: listing.feedMediaCreatedAt,
    });
  }, [accountSlug, listing]);

  const overviewChannels = listingCardFeedChannels(channels);
  const hasIssue = listingCardFeedsHaveIssue(channels);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-test="listing-card-feeds"
            data-sync-state={hasIssue ? 'issue' : 'ok'}
            aria-label={
              hasIssue
                ? 'Feeds — one or more channels need attention'
                : 'Feeds — switched-on channels are live and in sync'
            }
            className={cn(
              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
              'focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none',
              hasIssue
                ? 'text-amber-500'
                : 'text-emerald-600 dark:text-emerald-400',
              className,
            )}
          >
            <Rss className="h-4 w-4" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="w-80 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 text-[var(--workspace-shell-text)] shadow-md"
          data-test="listing-card-feeds-overview"
        >
          <ListingFeedsOverview channels={overviewChannels} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
