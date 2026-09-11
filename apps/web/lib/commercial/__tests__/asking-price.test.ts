import { describe, expect, it } from 'vitest';

import {
  askingPriceQualifierPrefix,
  buildPropertyHiveAskingPrice,
  formatAskingPrice,
  parseAskingPriceField,
  parseAskingPriceQualifier,
  rightmoveSaleDisplayQualifier,
} from '../asking-price';

describe('formatAskingPrice', () => {
  it('formats a bare asking price', () => {
    expect(
      formatAskingPrice({
        askingPricePence: 10_000_000,
        askingPriceQualifier: 'none',
      }),
    ).toBe('£100,000');
  });

  it('uses portal-canonical prefixes', () => {
    expect(
      formatAskingPrice({
        askingPricePence: 10_000_000,
        askingPriceQualifier: 'offers_in_excess_of',
      }),
    ).toBe('Offers in Excess of £100,000');
    expect(
      formatAskingPrice({
        askingPricePence: 10_000_000,
        askingPriceQualifier: 'offers_in_region_of',
      }),
    ).toBe('Offers in Region of £100,000');
    expect(
      formatAskingPrice({
        askingPricePence: 10_000_000,
        askingPriceQualifier: 'guide_price',
      }),
    ).toBe('Guide Price £100,000');
  });

  it('lets POA win over qualifier and amount', () => {
    expect(
      formatAskingPrice({
        askingPricePence: 10_000_000,
        askingPriceQualifier: 'guide_price',
        hidePriceFromMarketing: true,
      }),
    ).toBe('POA');
  });

  it('returns null when there is no amount and price is shown', () => {
    expect(
      formatAskingPrice({
        askingPricePence: null,
        askingPriceQualifier: 'offers_in_excess_of',
      }),
    ).toBeNull();
  });

  it('does not emit Josh-literal Guiding or In region of', () => {
    const region = formatAskingPrice({
      askingPricePence: 20_000_000,
      askingPriceQualifier: 'offers_in_region_of',
    });
    const guide = formatAskingPrice({
      askingPricePence: 20_000_000,
      askingPriceQualifier: 'guide_price',
    });
    expect(region).not.toMatch(/^In region of/i);
    expect(region).toBe('Offers in Region of £200,000');
    expect(guide).not.toMatch(/guiding/i);
    expect(guide).toBe('Guide Price £200,000');
  });
});

describe('askingPriceQualifierPrefix', () => {
  it('is empty for none and portal-canonical otherwise', () => {
    expect(askingPriceQualifierPrefix('none')).toBeNull();
    expect(askingPriceQualifierPrefix('offers_in_excess_of')).toBe(
      'Offers in Excess of',
    );
    expect(askingPriceQualifierPrefix('unknown')).toBeNull();
  });
});

describe('parseAskingPriceField', () => {
  it('keeps pence and detects qualifiers from pasted sale strings', () => {
    expect(parseAskingPriceField('Offers in Excess of £200,000')).toEqual({
      pence: 20_000_000,
      qualifier: 'offers_in_excess_of',
    });
    expect(parseAskingPriceField('OIEO £250,000')).toEqual({
      pence: 25_000_000,
      qualifier: 'offers_in_excess_of',
    });
    expect(parseAskingPriceField('Offers in Region of £180,000')).toEqual({
      pence: 18_000_000,
      qualifier: 'offers_in_region_of',
    });
    expect(parseAskingPriceField('OIRO 150000')).toEqual({
      pence: 15_000_000,
      qualifier: 'offers_in_region_of',
    });
    expect(parseAskingPriceField('In region of £90,000')).toEqual({
      pence: 9_000_000,
      qualifier: 'offers_in_region_of',
    });
    expect(parseAskingPriceField('Guide Price £350,000')).toEqual({
      pence: 35_000_000,
      qualifier: 'guide_price',
    });
    expect(parseAskingPriceField('Guiding £400,000')).toEqual({
      pence: 40_000_000,
      qualifier: 'guide_price',
    });
    expect(parseAskingPriceField('£100,000')).toEqual({
      pence: 10_000_000,
      qualifier: 'none',
    });
  });

  it('parses stored enum tokens', () => {
    expect(parseAskingPriceQualifier('offers_in_excess_of')).toBe(
      'offers_in_excess_of',
    );
    expect(parseAskingPriceQualifier('guide_price')).toBe('guide_price');
  });
});

describe('rightmoveSaleDisplayQualifier', () => {
  it('maps the three sale qualifiers and omits none', () => {
    expect(
      rightmoveSaleDisplayQualifier({
        askingPriceQualifier: 'offers_in_excess_of',
      }),
    ).toBe('OFFERS_IN_EXCESS_OF');
    expect(
      rightmoveSaleDisplayQualifier({
        askingPriceQualifier: 'offers_in_region_of',
      }),
    ).toBe('OFFERS_IN_REGION_OF');
    expect(
      rightmoveSaleDisplayQualifier({
        askingPriceQualifier: 'guide_price',
      }),
    ).toBe('GUIDE_PRICE');
    expect(
      rightmoveSaleDisplayQualifier({ askingPriceQualifier: 'none' }),
    ).toBeUndefined();
  });

  it('sends PRICE_ON_APPLICATION when POA', () => {
    expect(
      rightmoveSaleDisplayQualifier({
        hidePriceFromMarketing: true,
        askingPriceQualifier: 'guide_price',
      }),
    ).toBe('PRICE_ON_APPLICATION');
  });
});

describe('buildPropertyHiveAskingPrice', () => {
  it('writes a prefixed <price> and qualifier text', () => {
    expect(
      buildPropertyHiveAskingPrice({
        includesForSale: true,
        askingPricePence: 10_000_000,
        askingPriceQualifier: 'offers_in_excess_of',
        hidePriceFromMarketing: false,
      }),
    ).toEqual({
      price: 'Offers in Excess of £100,000',
      qualifier: 'Offers in Excess of',
      valuePounds: 100_000,
      onApplication: false,
      hasSalePriceBlock: true,
    });
  });

  it('uses Offers in Region of and Guide Price canonically', () => {
    expect(
      buildPropertyHiveAskingPrice({
        includesForSale: true,
        askingPricePence: 20_000_000,
        askingPriceQualifier: 'offers_in_region_of',
        hidePriceFromMarketing: false,
      }),
    ).toMatchObject({
      price: 'Offers in Region of £200,000',
      qualifier: 'Offers in Region of',
      valuePounds: 200_000,
    });
    expect(
      buildPropertyHiveAskingPrice({
        includesForSale: true,
        askingPricePence: 20_000_000,
        askingPriceQualifier: 'guide_price',
        hidePriceFromMarketing: false,
      }),
    ).toMatchObject({
      price: 'Guide Price £200,000',
      qualifier: 'Guide Price',
    });
  });

  it('leaves qualifier empty for a bare asking price', () => {
    expect(
      buildPropertyHiveAskingPrice({
        includesForSale: true,
        askingPricePence: 10_000_000,
        askingPriceQualifier: 'none',
        hidePriceFromMarketing: false,
      }),
    ).toEqual({
      price: '£100,000',
      qualifier: '',
      valuePounds: 100_000,
      onApplication: false,
      hasSalePriceBlock: true,
    });
  });

  it('emits POA with empty qualifier when hidden', () => {
    expect(
      buildPropertyHiveAskingPrice({
        includesForSale: true,
        askingPricePence: 10_000_000,
        askingPriceQualifier: 'guide_price',
        hidePriceFromMarketing: true,
      }),
    ).toEqual({
      price: 'POA',
      qualifier: '',
      valuePounds: null,
      onApplication: true,
      hasSalePriceBlock: true,
    });
  });

  it('omits sale price for to-let only', () => {
    expect(
      buildPropertyHiveAskingPrice({
        includesForSale: false,
        askingPricePence: 10_000_000,
        askingPriceQualifier: 'guide_price',
        hidePriceFromMarketing: false,
      }),
    ).toEqual({
      price: '',
      qualifier: '',
      valuePounds: null,
      onApplication: false,
      hasSalePriceBlock: false,
    });
  });
});
