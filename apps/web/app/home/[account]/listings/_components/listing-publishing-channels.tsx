'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Switch } from '@kit/ui/switch';

import {
  isEachFeedIncluded,
  isWebsiteFeedIncluded,
} from '~/lib/commercial/each-feed-inclusion';
import { getMarketingReadiness } from '~/lib/commercial/marketing-readiness';
import { workspacePanelCard } from '~/lib/workspace-ui';

import type {
  CommercialListing,
  CommercialListingMedia,
  CommercialPortalPublication,
} from '../_lib/server/listings.service';
import { useDisposalAccess } from './disposal-access-context';
import { ListingEachFeedToggle } from './listing-each-feed-toggle';
import { ListingWebsiteFeedToggle } from './listing-website-feed-toggle';
import { confirmPublishIfNotReady } from './marketing-readiness-card';

export function ListingPublishingChannels({
  listing,
  publications,
  accountId,
  media = [],
}: {
  listing: CommercialListing;
  publications: CommercialPortalPublication[];
  accountId: string;
  media?: CommercialListingMedia[];
}) {
  const { canEditDisposals } = useDisposalAccess();

  const confirmReady = () =>
    confirmPublishIfNotReady(
      getMarketingReadiness({ listing, media, publications }),
    );

  return (
    <Card
      id="channels"
      className={`${workspacePanelCard} scroll-mt-36`}
      data-tour="sop-listing-publish"
    >
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          Channels
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          Choose where this disposal appears. Website and EACH are live XML
          feeds. Rightmove is not live yet.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ChannelRow>
          <ListingWebsiteFeedToggle
            accountId={accountId}
            listingId={listing.id}
            initialEnabled={isWebsiteFeedIncluded(publications)}
            disabled={!canEditDisposals}
            onBeforeEnable={confirmReady}
          />
        </ChannelRow>

        <ChannelRow>
          <ListingEachFeedToggle
            accountId={accountId}
            listingId={listing.id}
            initialEnabled={isEachFeedIncluded(publications)}
            disabled={!canEditDisposals}
            onBeforeEnable={confirmReady}
          />
        </ChannelRow>

        <ChannelRow disabled>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Rightmove
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Coming soon — not live
              </p>
            </div>
            <Switch
              checked={false}
              disabled
              aria-label="Rightmove is not live yet"
            />
          </div>
        </ChannelRow>
      </CardContent>
    </Card>
  );
}

function ChannelRow({
  children,
  disabled = false,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-3 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      {children}
    </div>
  );
}
