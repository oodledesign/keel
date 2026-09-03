/** Opt-out model: included unless EACH publication status is unpublished. */
export function isEachFeedIncluded(
  publications: Array<{ portal: string; status: string }>,
): boolean {
  const each = publications.find((pub) => pub.portal === 'each');
  return !each || each.status !== 'unpublished';
}

/**
 * Website (Property Hive XML) is opt-out: included unless the property_hive
 * publication status is unpublished. No row means included — existing
 * on-market listings stay in the feed.
 */
export function isWebsiteFeedIncluded(
  publications: Array<{ portal: string; status: string }>,
): boolean {
  const website = publications.find((pub) => pub.portal === 'property_hive');
  return !website || website.status !== 'unpublished';
}

/**
 * EACH and website (Property Hive XML) are opt-out:
 * exclude listings with an `unpublished` publication for that portal.
 * Missing unpublished ids for website leave Property Hive unfiltered
 * (default included).
 */
export function filterOnMarketListingsForPortalFeed<
  T extends { id: string },
>(input: {
  portal: 'property_hive' | 'each';
  listings: T[];
  unpublishedEachListingIds: ReadonlySet<string>;
  unpublishedWebsiteListingIds?: ReadonlySet<string>;
}): T[] {
  if (input.portal === 'each') {
    return input.listings.filter(
      (listing) => !input.unpublishedEachListingIds.has(listing.id),
    );
  }

  const unpublishedWebsite = input.unpublishedWebsiteListingIds ?? new Set();
  return input.listings.filter(
    (listing) => !unpublishedWebsite.has(listing.id),
  );
}
