'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { ExternalLink } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import {
  type ChannelPublishStatus,
  getEachChannelStatus,
  getRightmoveChannelStatus,
  getWebsiteChannelStatus,
} from '~/lib/commercial/channel-publish-status';
import {
  isPublicListingPageUrl,
  resolveStoredOrTemplatedWebsiteUrl,
} from '~/lib/commercial/listing-website-url';
import { getMarketingReadiness } from '~/lib/commercial/marketing-readiness';
import { workspacePanelCard } from '~/lib/workspace-ui';

import { ensureWebsiteFeedReadyAction } from '../../commercial-publishing/_lib/server/server-actions';
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
  listingUrlTemplate = null,
}: {
  listing: CommercialListing;
  publications: CommercialPortalPublication[];
  accountId: string;
  media?: CommercialListingMedia[];
  /** Workspace Property Hive listing URL template (XML-only sites). */
  listingUrlTemplate?: string | null;
}) {
  const router = useRouter();
  const { canEditDisposals } = useDisposalAccess();
  const [fixPending, startFix] = useTransition();

  const websiteStatus = getWebsiteChannelStatus({
    listing: {
      status: listing.status,
      externalId: listing.externalId,
      websiteUrl: listing.websiteUrl,
    },
    publications,
  });
  const eachStatus = getEachChannelStatus({
    listing: {
      status: listing.status,
      externalId: listing.externalId,
      websiteUrl: listing.websiteUrl,
      sizeMinSqft: listing.sizeMinSqft,
      name: listing.name,
      postcode: listing.postcode,
      disposalType: listing.disposalType,
    },
    publications,
  });
  const rightmoveStatus = getRightmoveChannelStatus();

  const confirmReady = () =>
    confirmPublishIfNotReady(
      getMarketingReadiness({ listing, media, publications }),
    );

  const phPublication = publications.find((p) => p.portal === 'property_hive');
  const resolvedWebsiteUrl =
    resolveStoredOrTemplatedWebsiteUrl({
      websiteUrl: listing.websiteUrl,
      portalExternalUrl: phPublication?.externalUrl ?? null,
      template: listingUrlTemplate,
      listing: {
        externalId: listing.externalId,
        addressLine1: listing.addressLine1,
        addressLine2: listing.addressLine2,
        town: listing.town,
        postcode: listing.postcode,
        name: listing.name,
      },
    }) ?? '';
  const websiteUrl = resolvedWebsiteUrl;
  const showWebsiteLink =
    websiteUrl.length > 0 && isPublicListingPageUrl(websiteUrl);
  const needsFeedIdFix =
    websiteStatus.state === 'blocked' &&
    websiteStatus.blockers.some((b) => /feed id/i.test(b));

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
        {showWebsiteLink ? (
          <div className="pt-1">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={websiteUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open website listing
              </a>
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <ChannelRow>
          <ListingWebsiteFeedToggle
            accountId={accountId}
            listingId={listing.id}
            initialEnabled={websiteStatus.switchOn}
            disabled={
              !canEditDisposals ||
              (!websiteStatus.switchOn && !websiteStatus.canEnable)
            }
            onBeforeEnable={confirmReady}
          />
          <ChannelStatusBanner status={websiteStatus} />
          {needsFeedIdFix && canEditDisposals ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={fixPending}
              onClick={() => {
                startFix(async () => {
                  try {
                    await ensureWebsiteFeedReadyAction({
                      accountId,
                      listingId: listing.id,
                    });
                    toast.success(
                      'Website feed id assigned — listing will appear on the next Property Hive import',
                    );
                    router.refresh();
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Could not prepare website feed',
                    );
                  }
                });
              }}
            >
              {fixPending ? 'Fixing…' : 'Assign feed id & publish'}
            </Button>
          ) : null}
        </ChannelRow>

        <ChannelRow>
          <ListingEachFeedToggle
            accountId={accountId}
            listingId={listing.id}
            initialEnabled={eachStatus.switchOn}
            disabled={
              !canEditDisposals ||
              (!eachStatus.switchOn && !eachStatus.canEnable)
            }
            onBeforeEnable={confirmReady}
          />
          <ChannelStatusBanner status={eachStatus} />
        </ChannelRow>

        <ChannelRow disabled>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Rightmove
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                {rightmoveStatus.detail}
              </p>
            </div>
            <Switch
              checked={false}
              disabled
              aria-label="Rightmove is not live yet"
            />
          </div>
          <ChannelStatusBanner status={rightmoveStatus} />
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
      className={`space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-3 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      {children}
    </div>
  );
}

function ChannelStatusBanner({ status }: { status: ChannelPublishStatus }) {
  const tone =
    status.state === 'live'
      ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
      : status.state === 'blocked'
        ? 'bg-amber-500/10 text-amber-900 dark:text-amber-200'
        : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]';

  return (
    <div className={`rounded-md px-2.5 py-2 text-xs ${tone}`}>
      <p className="font-medium">
        {status.label}
        <span className="font-normal opacity-80"> — {status.detail}</span>
      </p>
      {status.blockers.length > 0 ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {status.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}
      {status.lastError &&
      status.state === 'blocked' &&
      !status.blockers.includes(status.lastError) ? (
        <p className="mt-1 opacity-90">{status.lastError}</p>
      ) : null}
    </div>
  );
}
