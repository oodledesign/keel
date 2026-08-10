/** Opt-out model: included unless EACH publication status is unpublished. */
export function isEachFeedIncluded(
  publications: Array<{ portal: string; status: string }>,
): boolean {
  const each = publications.find((pub) => pub.portal === 'each');
  return !each || each.status !== 'unpublished';
}

/**
 * EACH is opt-out: exclude listings with an `unpublished` EACH publication.
 * Property Hive keeps exporting all on-market listings.
 */
export function filterOnMarketListingsForPortalFeed<
  T extends { id: string },
>(input: {
  portal: 'property_hive' | 'each';
  listings: T[];
  unpublishedEachListingIds: ReadonlySet<string>;
}): T[] {
  if (input.portal !== 'each') return input.listings;
  return input.listings.filter(
    (listing) => !input.unpublishedEachListingIds.has(listing.id),
  );
}
