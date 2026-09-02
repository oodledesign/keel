import { describe, expect, it } from 'vitest';

import {
  type OverlayListing,
  buildOverlaySpec,
  buildOverlaySvg,
  overlayPriceLine,
  overlayStandoutLine,
  overlayStatusChip,
  overlayStatusLabel,
} from './overlay';

function listing(overrides: Partial<OverlayListing> = {}): OverlayListing {
  return {
    status: 'marketing',
    disposalType: 'to_let',
    town: 'Tonbridge',
    askingRentPence: 2_550_000,
    askingRentToPence: null,
    askingPricePence: null,
    rentFrequency: 'per_annum',
    hideRentFromMarketing: false,
    hidePriceFromMarketing: false,
    sizeMinSqft: 1776,
    sizeMaxSqft: 1776,
    ...overrides,
  };
}

describe('overlay status mapping', () => {
  it('uses disposal type for live marketing stock', () => {
    expect(overlayStatusLabel('marketing', 'to_let')).toBe('To let');
    expect(overlayStatusLabel('instructed', 'for_sale')).toBe('For sale');
    expect(overlayStatusChip('marketing', 'to_let')).toBe('TO LET');
  });

  it('uses listing status for under offer / let / sold', () => {
    expect(overlayStatusLabel('under_offer', 'to_let')).toBe('Under offer');
    expect(overlayStatusChip('under_offer', 'to_let')).toBe('UNDER OFFER');
    expect(overlayStatusLabel('let', 'to_let')).toBe('Let');
    expect(overlayStatusLabel('sold', 'for_sale')).toBe('Sold');
  });
});

describe('overlay price and standout', () => {
  it('shows rent unless hidden', () => {
    expect(overlayPriceLine(listing())).toContain('£25,500');
    expect(overlayPriceLine(listing({ hideRentFromMarketing: true }))).toBe(
      'POA',
    );
  });

  it('prefers town, then size', () => {
    expect(overlayStandoutLine(listing())).toBe('Tonbridge');
    expect(overlayStandoutLine(listing({ town: null }))).toBe('1,776 sq ft');
  });

  it('records the overlay-first flag on the spec', () => {
    expect(buildOverlaySpec(listing(), true).overlayFirst).toBe(true);
    expect(buildOverlaySpec(listing(), false).overlayFirst).toBe(false);
  });
});

describe('overlay SVG', () => {
  it('includes cream/plum/coral brand colours and the chip text', () => {
    const svg = buildOverlaySvg(buildOverlaySpec(listing()));
    expect(svg).toContain('TO LET');
    expect(svg).toContain('#FF5C34');
    expect(svg).toContain('#FBF6EC');
    expect(svg).toContain('#2A1720');
    expect(svg).toContain('Tonbridge');
  });
});
