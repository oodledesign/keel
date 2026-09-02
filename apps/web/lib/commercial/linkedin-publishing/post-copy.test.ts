import { describe, expect, it } from 'vitest';

import {
  appendListingUrl,
  buildDescriptionSourceCopy,
  buildStructuredLinkedInCopy,
  clampHashtags,
  countHashtags,
  formatUseClassShort,
} from './post-copy';
import type { LinkedInCopyListing } from './post-copy';

function listing(
  overrides: Partial<LinkedInCopyListing> = {},
): LinkedInCopyListing {
  return {
    name: '4B Valley Industries',
    addressLine1: '4B Valley Industries',
    addressLine2: null,
    town: 'Tonbridge',
    county: 'Kent',
    postcode: 'TN11 0AG',
    disposalType: 'to_let',
    tenure: 'new_lease',
    useClass: 'CLASS_B8',
    askingRentPence: 2_550_000,
    askingRentToPence: null,
    askingPricePence: null,
    rentFrequency: 'per_annum',
    hideRentFromMarketing: false,
    hidePriceFromMarketing: false,
    sizeMinSqft: 1776,
    sizeMaxSqft: 1776,
    summary: 'Industrial unit to let in Tonbridge.',
    description: 'A modern industrial unit on a secure estate.',
    keyPoints: ['Secure estate', 'Eaves 6m', 'Yard access', 'Extra point'],
    sector: 'Industrial / Warehouse',
    ...overrides,
  };
}

describe('appendListingUrl', () => {
  it('puts the URL on its own last line', () => {
    expect(
      appendListingUrl('Unit to let in Tonbridge.', 'https://app.ozer.so/x'),
    ).toBe('Unit to let in Tonbridge.\n\nhttps://app.ozer.so/x');
  });

  it('does not invent a URL when none exists', () => {
    expect(appendListingUrl('Draft copy', null)).toBe('Draft copy');
  });

  it('moves a duplicated URL to the last line', () => {
    expect(
      appendListingUrl(
        'See https://www.bracketts.co.uk/p/1\nMore text',
        'https://www.bracketts.co.uk/p/1',
      ),
    ).toBe('See\nMore text\n\nhttps://www.bracketts.co.uk/p/1');
  });
});

describe('hashtag clamp', () => {
  it('counts and strips extra hashtags', () => {
    const raw = 'Unit to let #commercial #industrial #tonbridge #kent #tolet';
    expect(countHashtags(raw)).toBe(5);
    const clamped = clampHashtags(raw, 3);
    expect(countHashtags(clamped)).toBe(3);
    expect(clamped).toContain('#commercial');
    expect(clamped).not.toContain('#kent');
  });
});

describe('buildDescriptionSourceCopy', () => {
  it('uses the listing description and appends the URL', () => {
    expect(
      buildDescriptionSourceCopy({
        summary: 'Short',
        description: 'Longer brochure copy.',
        listingUrl: 'https://www.bracketts.co.uk/p/1',
      }),
    ).toBe('Longer brochure copy.\n\nhttps://www.bracketts.co.uk/p/1');
  });
});

describe('buildStructuredLinkedInCopy', () => {
  it('includes address, size, tenure, rent, sector, use class, and key points', () => {
    const body = buildStructuredLinkedInCopy(
      listing(),
      'https://www.bracketts.co.uk/property/4b',
    );
    expect(body).toContain('To let');
    expect(body).toContain('Tonbridge');
    expect(body).toContain('1,776 sq ft');
    expect(body).toContain('New Lease');
    expect(body).toContain('£25,500 pa');
    expect(body).toContain('Industrial / Warehouse');
    expect(body).toContain('Class B8');
    expect(body).toContain('Secure estate');
    expect(body).not.toContain('Extra point');
    expect(body.endsWith('https://www.bracketts.co.uk/property/4b')).toBe(true);
  });

  it('uses POA when rent is hidden from marketing', () => {
    const body = buildStructuredLinkedInCopy(
      listing({ hideRentFromMarketing: true }),
    );
    expect(body).toContain('POA');
    expect(body).not.toContain('£25,500');
  });
});

describe('formatUseClassShort', () => {
  it('maps CLASS_E to a short UK label', () => {
    expect(formatUseClassShort('CLASS_E')).toMatch(/Class E/i);
  });
});
