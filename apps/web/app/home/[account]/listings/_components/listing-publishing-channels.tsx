'use client';

import { useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { ExternalLink } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';

import {
  channelEnableCanContinue,
  createChannelEnableGate,
} from '~/lib/commercial/channel-enable-gate';
import {
  type ChannelPublishBlocker,
  collectChannelPublishBlockers,
} from '~/lib/commercial/channel-publish-blockers';
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
import { isRightmoveSyncStale } from '~/lib/commercial/portal-sync-policy';
import { workspacePanelCard } from '~/lib/workspace-ui';

import {
  ensureWebsiteFeedReadyAction,
  republishRightmoveListingAction,
} from '../../commercial-publishing/_lib/server/server-actions';
import type {
  CommercialListing,
  CommercialListingMedia,
  CommercialPortalPublication,
} from '../_lib/server/listings.service';
import { useDisposalAccess } from './disposal-access-context';
import { ListingChannelEnableDialog } from './listing-channel-enable-dialog';
import { ListingEachFeedToggle } from './listing-each-feed-toggle';
import { ListingRightmoveFeedToggle } from './listing-rightmove-feed-toggle';
import { ListingWebsiteFeedToggle } from './listing-website-feed-toggle';
import { RightmoveListingLinks } from './rightmove-listing-links';

export function ListingPublishingChannels({
  listing,
  publications,
  accountId,
  accountSlug,
  media = [],
  listingUrlTemplate = null,
}: {
  listing: CommercialListing;
  publications: CommercialPortalPublication[];
  accountId: string;
  accountSlug: string;
  media?: CommercialListingMedia[];
  /** Workspace Property Hive listing URL template (XML-only sites). */
  listingUrlTemplate?: string | null;
}) {
  const router = useRouter();
  const { canEditDisposals } = useDisposalAccess();
  const [fixPending, startFix] = useTransition();
  const [resyncPending, startResync] = useTransition();
  const [enableDialog, setEnableDialog] = useState<{
    channelLabel: string;
    blockers: ChannelPublishBlocker[];
    canContinue: boolean;
  } | null>(null);
  const enableGateRef = useRef(createChannelEnableGate());

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
  const rightmoveStatus = getRightmoveChannelStatus({
    listing: {
      status: listing.status,
      name: listing.name,
      postcode: listing.postcode,
      addressLine1: listing.addressLine1,
    },
    publications,
  });
  const readiness = getMarketingReadiness({ listing, media, publications });
  const rightmovePublication = publications.find(
    (publication) => publication.portal === 'rightmove',
  );
  const eachPublication = publications.find(
    (publication) => publication.portal === 'each',
  );
  const rightmoveOutOfSync = isRightmoveSyncStale({
    publicationStatus: rightmovePublication?.status,
    lastSyncAt: rightmovePublication?.lastSyncAt,
    listingUpdatedAt: listing.updatedAt,
    mediaCreatedAt: media.map((item) => item.createdAt),
  });

  const requestEnable = (
    channelLabel: string,
    channel: ChannelPublishStatus,
    extraRequired: ChannelPublishBlocker[] = [],
  ) => {
    const blockers = collectChannelPublishBlockers({
      channel,
      readiness,
      accountSlug,
      listingId: listing.id,
      listingStatus: listing.status,
      extraRequired,
    });
    const canContinue = channelEnableCanContinue({
      canEnable: channel.canEnable,
      extraRequired,
    });

    if (blockers.length === 0) {
      return Promise.resolve(true);
    }

    setEnableDialog({ channelLabel, blockers, canContinue });
    return enableGateRef.current.request();
  };

  const closeEnableDialog = (allowed: boolean) => {
    enableGateRef.current.settle(allowed);
    setEnableDialog(null);
  };

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
  const eachUrl = eachPublication?.externalUrl?.trim() ?? '';
  const showEachLink = eachUrl.length > 0 && isPublicListingPageUrl(eachUrl);
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
          feeds. Rightmove publishes when you turn it on, then stays in sync
          when status or media changes.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rightmoveOutOfSync ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-500/10 px-2.5 py-2 text-xs text-amber-900 dark:text-amber-200"
            data-test="rightmove-out-of-sync"
          >
            <p>
              Rightmove is behind this disposal — Website and EACH pick up
              changes on the next import, but Rightmove still has the last push.
            </p>
            {canEditDisposals ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={resyncPending}
                onClick={() => {
                  startResync(async () => {
                    try {
                      await republishRightmoveListingAction({
                        accountId,
                        listingId: listing.id,
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
                }}
              >
                {resyncPending ? 'Re-syncing…' : 'Re-sync Rightmove'}
              </Button>
            ) : null}
          </div>
        ) : null}
        <ChannelRow>
          <ListingWebsiteFeedToggle
            accountId={accountId}
            listingId={listing.id}
            initialEnabled={websiteStatus.switchOn}
            disabled={!canEditDisposals}
            onBeforeEnable={() => requestEnable('Website', websiteStatus)}
          />
          <ChannelStatusBanner status={websiteStatus} />
          {showWebsiteLink ? (
            <ChannelOpenLink href={websiteUrl} label="Open website listing" />
          ) : null}
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
            disabled={!canEditDisposals}
            onBeforeEnable={() => requestEnable('EACH', eachStatus)}
          />
          <ChannelStatusBanner status={eachStatus} />
          {showEachLink ? (
            <ChannelOpenLink href={eachUrl} label="Open EACH listing" />
          ) : null}
        </ChannelRow>

        <ChannelRow>
          <ListingRightmoveFeedToggle
            accountId={accountId}
            listingId={listing.id}
            initialEnabled={rightmoveStatus.switchOn}
            disabled={!canEditDisposals}
            onBeforeEnable={() => requestEnable('Rightmove', rightmoveStatus)}
          />
          <ChannelStatusBanner status={rightmoveStatus} />
          <RightmoveListingLinks publications={publications} />
        </ChannelRow>
      </CardContent>

      <ListingChannelEnableDialog
        open={Boolean(enableDialog)}
        onOpenChange={(open) => {
          if (!open) closeEnableDialog(false);
        }}
        channelLabel={enableDialog?.channelLabel ?? ''}
        blockers={enableDialog?.blockers ?? []}
        canContinue={enableDialog?.canContinue ?? false}
        onContinue={() => closeEnableDialog(true)}
      />
    </Card>
  );
}

function ChannelOpenLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" size="sm" className="gap-1.5">
      <a href={href} target="_blank" rel="noreferrer">
        <ExternalLink className="h-3.5 w-3.5" />
        {label}
      </a>
    </Button>
  );
}

function ChannelRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-3">
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
