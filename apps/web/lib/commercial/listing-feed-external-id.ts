/**
 * Property Hive / EACH XML feeds match on Kato `<id>` / `<object_id>`.
 * Ozer-native disposals have no Kato id — we persist the listing UUID as
 * `commercial_listings.external_id` so they enter the feed with a stable key
 * (avoids the old skip-null-external_id filter + duplicate WP posts if the
 * id later changed).
 */

export function resolveListingFeedExternalId(
  existing: string | null | undefined,
  listingId: string,
): string {
  const trimmed = existing?.trim();
  return trimmed || listingId;
}

export function listingNeedsFeedExternalId(
  existing: string | null | undefined,
): boolean {
  return !Boolean(existing?.trim());
}
