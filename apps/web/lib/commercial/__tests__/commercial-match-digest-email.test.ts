import { describe, expect, it } from 'vitest';

import {
  buildCommercialMatchDigestBodyHtml,
  groupDigestMatchesByListing,
  matchScorePillColors,
  matchScoreStrength,
} from '../commercial-match-digest-email';

describe('matchScoreStrength', () => {
  it('classifies strong / medium / low bands', () => {
    expect(matchScoreStrength(90)).toBe('strong');
    expect(matchScoreStrength(75)).toBe('strong');
    expect(matchScoreStrength(74)).toBe('medium');
    expect(matchScoreStrength(55)).toBe('medium');
    expect(matchScoreStrength(54)).toBe('low');
  });
});

describe('matchScorePillColors', () => {
  it('uses green for strong matches', () => {
    expect(matchScorePillColors(82).color).toBe('#1B7A3D');
    expect(matchScorePillColors(82).background).toBe('#E6F4EA');
  });
});

describe('groupDigestMatchesByListing', () => {
  it('groups requirement matches under each property and sorts by score', () => {
    const groups = groupDigestMatchesByListing([
      {
        listingId: 'l1',
        listingName: 'Alpha House',
        requirementLabel: 'Acme Ltd',
        score: 88,
        listingCoverUrl: 'https://example.com/a.jpg',
      },
      {
        listingId: 'l2',
        listingName: 'Beta Yard',
        requirementLabel: 'Beta Co',
        score: 70,
      },
      {
        listingId: 'l1',
        listingName: 'Alpha House',
        requirementLabel: 'Other Buyer',
        score: 61,
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.listingId).toBe('l1');
    expect(groups[0]?.listingCoverUrl).toBe('https://example.com/a.jpg');
    expect(groups[0]?.matches.map((m) => m.requirementLabel)).toEqual([
      'Acme Ltd',
      'Other Buyer',
    ]);
    expect(groups[1]?.listingName).toBe('Beta Yard');
  });
});

describe('buildCommercialMatchDigestBodyHtml', () => {
  it('renders property groups, score pills, and a view-all link when truncated', () => {
    const { html, renderedPairCount, renderedListingCount } =
      buildCommercialMatchDigestBodyHtml({
        accountName: 'Bracketts',
        totalCount: 12,
        viewAllHref:
          'https://app.ozer.so/home/bracketts/pipeline?view=requirements',
        suggestions: [
          {
            listingId: 'l1',
            listingName: 'Alpha House',
            requirementLabel: 'Acme Ltd',
            score: 88,
            listingCoverUrl: 'https://cdn.example/a.jpg',
          },
          {
            listingId: 'l1',
            listingName: 'Alpha House',
            requirementLabel: 'Other Buyer',
            score: 61,
          },
          {
            listingId: 'l2',
            listingName: 'Beta Yard',
            requirementLabel: 'Beta Co',
            score: 54,
          },
        ],
      });

    expect(renderedListingCount).toBe(2);
    expect(renderedPairCount).toBe(3);
    expect(html).toContain('Alpha House');
    expect(html).toContain('Acme Ltd');
    expect(html).toContain('Other Buyer');
    expect(html).toContain('Beta Yard');
    expect(html).toContain('88%');
    expect(html).toContain('View all 12 matches');
    expect(html).toContain('https://cdn.example/a.jpg');
    expect(html).toContain('#E6F4EA');
    expect(html).not.toContain('Alpha House</strong> ↔');
  });

  it('escapes listing and requirement names', () => {
    const { html } = buildCommercialMatchDigestBodyHtml({
      accountName: 'A & B',
      totalCount: 1,
      viewAllHref: 'https://app.ozer.so/x',
      suggestions: [
        {
          listingId: 'l1',
          listingName: '<script>x</script>',
          requirementLabel: 'Foo & Bar',
          score: 80,
        },
      ],
    });

    expect(html).toContain('A &amp; B');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('Foo &amp; Bar');
    expect(html).not.toContain('<script>x</script>');
  });
});
