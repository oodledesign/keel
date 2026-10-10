import {
  getEachChannelStatus,
  getRightmoveChannelStatus,
  getWebsiteChannelStatus,
} from '~/lib/commercial/channel-publish-status';
import type { WebsiteUrlHealth } from '~/lib/commercial/listing-website-url-health';

import type {
  CommercialListing,
  CommercialListingMedia,
  CommercialPortalPublication,
} from './server/listings.service';

export type ListingChannelStatusInput = {
  listing: CommercialListing;
  publications: CommercialPortalPublication[];
  media: Pick<CommercialListingMedia, 'createdAt'>[];
  websitePublicPageUrl?: string | null;
  websiteUrlHealth?: WebsiteUrlHealth | null;
};

export function listingChannelStatuses({
  listing,
  publications,
  media,
  websitePublicPageUrl = null,
  websiteUrlHealth = null,
}: ListingChannelStatusInput) {
  return {
    website: getWebsiteChannelStatus({
      listing: {
        status: listing.status,
        externalId: listing.externalId,
        websiteUrl: listing.websiteUrl,
      },
      publications,
      publicPageUrl: websitePublicPageUrl,
      urlHealth: websiteUrlHealth,
    }),
    each: getEachChannelStatus({
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
    rightmove: getRightmoveChannelStatus({
      listing: {
        status: listing.status,
        name: listing.name,
        postcode: listing.postcode,
        addressLine1: listing.addressLine1,
        updatedAt: listing.updatedAt,
      },
      publications,
      mediaCreatedAt: media.map((item) => item.createdAt),
    }),
  };
}

/** Feeds a published brochure is sent to, with whether each is switched on. */
export function listingBrochureChannels(input: ListingChannelStatusInput) {
  const statuses = listingChannelStatuses(input);
  return [
    { id: 'website', label: 'Website', on: statuses.website.switchOn },
    { id: 'each', label: 'EACH', on: statuses.each.switchOn },
    { id: 'rightmove', label: 'Rightmove', on: statuses.rightmove.switchOn },
  ];
}
