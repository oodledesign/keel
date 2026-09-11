import { describe, expect, it } from 'vitest';

import { recordToListingDraft } from '../listing-import';

describe('recordToListingDraft sale price qualifier', () => {
  it('parses portal-canonical prefixes from the sale price cell', () => {
    const draft = recordToListingDraft(1, {
      name: 'Unit 1',
      asking_price: 'Offers in Excess of £200,000',
    });

    expect(draft.askingPricePence).toBe(20_000_000);
    expect(draft.askingPriceQualifier).toBe('offers_in_excess_of');
  });

  it('prefers a dedicated qualifier column when present', () => {
    const draft = recordToListingDraft(1, {
      name: 'Unit 1',
      asking_price: '£200,000',
      asking_price_qualifier: 'Guide Price',
    });

    expect(draft.askingPricePence).toBe(20_000_000);
    expect(draft.askingPriceQualifier).toBe('guide_price');
  });
});
