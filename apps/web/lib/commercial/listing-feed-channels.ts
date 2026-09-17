import {
  type ChannelPublishStatus,
  getCirculationChannelStatus,
  getEachChannelStatus,
  getRightmoveChannelStatus,
  getWebsiteChannelStatus,
  switchedOnChannelsHaveIssue,
} from '~/lib/commercial/channel-publish-status';
import { listingTabHref } from '~/lib/commercial/listing-routes';
import type { WebsiteUrlHealth } from '~/lib/commercial/listing-website-url-health';

export type ListingFeedChannel = {
  key: string;
  label: string;
  href: string;
  status: ChannelPublishStatus;
};

export type ListingFeedListingInput = {
  id: string;
  status: string;
  externalId: string | null;
  websiteUrl?: string | null;
  sizeMinSqft?: number | null;
  name: string | null;
  postcode: string | null;
  addressLine1?: string | null;
  disposalType?: string | null;
  updatedAt?: string | null;
  autoCirculateMatches: boolean;
};

export type ListingFeedPublicationInput = {
  portal: string;
  status: string;
  lastError?: string | null;
  externalId?: string | null;
  externalUrl?: string | null;
  lastSyncAt?: string | null;
};

export function buildListingFeedChannels(input: {
  listing: ListingFeedListingInput;
  accountSlug: string;
  publications: ListingFeedPublicationInput[];
  mediaCreatedAt?: Array<string | null | undefined>;
  websitePublicPageUrl?: string | null;
  websiteUrlHealth?: WebsiteUrlHealth | null;
}): ListingFeedChannel[] {
  const publishingHref = listingTabHref(
    input.accountSlug,
    input.listing.id,
    'publishing',
  );
  const interestHref = listingTabHref(
    input.accountSlug,
    input.listing.id,
    'interest',
  );

  return [
    {
      key: 'website',
      label: 'Website',
      href: `${publishingHref}#channels`,
      status: getWebsiteChannelStatus({
        listing: {
          status: input.listing.status,
          externalId: input.listing.externalId,
          websiteUrl: input.listing.websiteUrl,
        },
        publications: input.publications,
        publicPageUrl: input.websitePublicPageUrl,
        urlHealth: input.websiteUrlHealth,
      }),
    },
    {
      key: 'each',
      label: 'EACH',
      href: `${publishingHref}#channels`,
      status: getEachChannelStatus({
        listing: {
          status: input.listing.status,
          externalId: input.listing.externalId,
          websiteUrl: input.listing.websiteUrl,
          sizeMinSqft: input.listing.sizeMinSqft,
          name: input.listing.name,
          postcode: input.listing.postcode,
          disposalType: input.listing.disposalType,
        },
        publications: input.publications,
      }),
    },
    {
      key: 'rightmove',
      label: 'Rightmove',
      href: `${publishingHref}#channels`,
      status: getRightmoveChannelStatus({
        listing: {
          status: input.listing.status,
          name: input.listing.name,
          postcode: input.listing.postcode,
          addressLine1: input.listing.addressLine1,
          updatedAt: input.listing.updatedAt,
        },
        publications: input.publications,
        mediaCreatedAt: input.mediaCreatedAt,
      }),
    },
    {
      key: 'circulation',
      label: 'Circulation',
      href: interestHref,
      status: getCirculationChannelStatus({
        listing: {
          status: input.listing.status,
          autoCirculateMatches: input.listing.autoCirculateMatches,
        },
      }),
    },
  ];
}

/** Card chrome shows marketing feeds only — not circulation mailouts. */
export const LISTING_CARD_FEED_KEYS = ['website', 'each', 'rightmove'] as const;

const LISTING_CARD_FEED_KEY_SET: ReadonlySet<string> = new Set(
  LISTING_CARD_FEED_KEYS,
);

export function listingCardFeedChannels(
  channels: ListingFeedChannel[],
): ListingFeedChannel[] {
  return channels.filter((channel) =>
    LISTING_CARD_FEED_KEY_SET.has(channel.key),
  );
}

/** Accepts the full feed list; circulation is ignored for card chrome. */
export function listingCardFeedsHaveIssue(
  channels: ListingFeedChannel[],
): boolean {
  return switchedOnChannelsHaveIssue(
    listingCardFeedChannels(channels).map((channel) => channel.status),
  );
}
