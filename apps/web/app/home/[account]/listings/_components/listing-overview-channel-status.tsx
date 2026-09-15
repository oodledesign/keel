'use client';

import Link from 'next/link';

import { AlertTriangle, Check, X } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

import {
  type ChannelPublishStatus,
  getCirculationChannelStatus,
  getEachChannelStatus,
  getRightmoveChannelStatus,
  getWebsiteChannelStatus,
} from '~/lib/commercial/channel-publish-status';
import { listingTabHref } from '~/lib/commercial/listing-routes';
import type { WebsiteUrlHealth } from '~/lib/commercial/listing-website-url-health';
import { workspacePanelCard } from '~/lib/workspace-ui';

import type {
  CommercialListing,
  CommercialPortalPublication,
} from '../_lib/server/listings.service';
import { ListingChannelSyncIcon } from './listing-channel-sync-icon';

type ChannelBadge = {
  key: string;
  label: string;
  href: string;
  status: ChannelPublishStatus;
};

function ChannelStatusIcon({ status }: { status: ChannelPublishStatus }) {
  if (status.outOfSync || status.state === 'blocked') {
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden />;
  }
  if (status.state === 'live') {
    return <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />;
  }
  return (
    <X
      className="h-3.5 w-3.5 text-[var(--workspace-shell-text)]/35"
      aria-hidden
    />
  );
}

function channelTone(status: ChannelPublishStatus) {
  if (status.outOfSync) {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200';
  }
  if (status.state === 'live') {
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300';
  }
  if (status.state === 'blocked') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200';
  }
  return 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]';
}

export function ListingOverviewChannelStatus({
  listing,
  accountId,
  accountSlug,
  publications,
  mediaCreatedAt = [],
  websitePublicPageUrl = null,
  websiteUrlHealth = null,
}: {
  listing: CommercialListing;
  accountId: string;
  accountSlug: string;
  publications: CommercialPortalPublication[];
  mediaCreatedAt?: Array<string | null | undefined>;
  websitePublicPageUrl?: string | null;
  websiteUrlHealth?: WebsiteUrlHealth | null;
}) {
  const publishingHref = listingTabHref(accountSlug, listing.id, 'publishing');
  const interestHref = listingTabHref(accountSlug, listing.id, 'interest');

  const channels: ChannelBadge[] = [
    {
      key: 'website',
      label: 'Website',
      href: `${publishingHref}#channels`,
      status: getWebsiteChannelStatus({
        listing: {
          status: listing.status,
          externalId: listing.externalId,
          websiteUrl: listing.websiteUrl,
        },
        publications,
        publicPageUrl: websitePublicPageUrl,
        urlHealth: websiteUrlHealth,
      }),
    },
    {
      key: 'each',
      label: 'EACH',
      href: `${publishingHref}#channels`,
      status: getEachChannelStatus({
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
      }),
    },
    {
      key: 'rightmove',
      label: 'Rightmove',
      href: `${publishingHref}#channels`,
      status: getRightmoveChannelStatus({
        listing: {
          status: listing.status,
          name: listing.name,
          postcode: listing.postcode,
          addressLine1: listing.addressLine1,
          updatedAt: listing.updatedAt,
        },
        publications,
        mediaCreatedAt,
      }),
    },
    {
      key: 'circulation',
      label: 'Circulation',
      href: interestHref,
      status: getCirculationChannelStatus({
        listing: {
          status: listing.status,
          autoCirculateMatches: listing.autoCirculateMatches,
        },
      }),
    },
  ];

  return (
    <Card className={workspacePanelCard} data-test="overview-channel-status">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Channels
          </CardTitle>
          <ListingChannelSyncIcon
            channels={channels}
            accountId={accountId}
            listingId={listing.id}
          />
        </div>
        <Link
          href={publishingHref}
          className="text-xs text-[var(--workspace-shell-text)]/50 hover:text-[var(--workspace-shell-text)] hover:underline"
        >
          Manage
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="flex flex-wrap gap-2">
          {channels.map((channel) => (
            <li key={channel.key}>
              <Link
                href={channel.href}
                title={channel.status.detail}
                data-test={`overview-channel-${channel.key}`}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                  channelTone(channel.status),
                )}
              >
                <ChannelStatusIcon status={channel.status} />
                <span>{channel.label}</span>
                <span className="font-normal opacity-80">
                  {channel.status.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
