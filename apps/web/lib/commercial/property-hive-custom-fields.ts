/**
 * Property Hive / Kato XML custom fields.
 *
 * The existing Kato-compatible feed had no custom-field block and used
 * `<id>` / `<object_id>` as `external_id || listing.id`, which is not a
 * reliable Ozer UUID. Property Hive Custom Field Mapping and Field Rules
 * can bind these nodes to a WP meta key of the same name.
 */
export const OZER_LISTING_ID_META_KEY = 'ozer_listing_id';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Kato XML child plus a named custom_fields pair.
 * PH import: map `ozer_listing_id` (or custom_fields/name) → meta `ozer_listing_id`.
 */
export function renderPropertyHiveOzerListingFields(listingId: string): string {
  const id = listingId.trim();
  if (!id) return '';

  const safe = escapeXml(id);
  return [
    `<${OZER_LISTING_ID_META_KEY}>${safe}</${OZER_LISTING_ID_META_KEY}>`,
    [
      '<custom_fields>',
      '<custom_field>',
      `<name>${OZER_LISTING_ID_META_KEY}</name>`,
      `<value>${safe}</value>`,
      '</custom_field>',
      '</custom_fields>',
    ].join(''),
  ].join('');
}
