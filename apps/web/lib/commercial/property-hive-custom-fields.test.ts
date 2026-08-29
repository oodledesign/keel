import { describe, expect, it } from 'vitest';

import {
  OZER_LISTING_ID_META_KEY,
  renderPropertyHiveOzerListingFields,
} from './property-hive-custom-fields';

describe('Property Hive Ozer listing custom fields', () => {
  it('uses the ozer_listing_id meta key', () => {
    expect(OZER_LISTING_ID_META_KEY).toBe('ozer_listing_id');
  });

  it('emits a Kato child element and a named custom_fields pair', () => {
    const listingId = '11111111-1111-4111-8111-111111111111';
    const xml = renderPropertyHiveOzerListingFields(listingId);

    expect(xml).toContain(`<ozer_listing_id>${listingId}</ozer_listing_id>`);
    expect(xml).toContain('<name>ozer_listing_id</name>');
    expect(xml).toContain(`<value>${listingId}</value>`);
  });

  it('escapes XML and skips empty ids', () => {
    expect(renderPropertyHiveOzerListingFields('')).toBe('');
    expect(renderPropertyHiveOzerListingFields('a&b')).toContain(
      '<ozer_listing_id>a&amp;b</ozer_listing_id>',
    );
  });
});
