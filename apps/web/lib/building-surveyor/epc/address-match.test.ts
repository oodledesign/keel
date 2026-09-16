import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  isHighConfidenceEpcMatch,
  rankEpcHits,
  resolveSurveyLookup,
  tokenizeAddress,
} from './address-match';
import { parseEpcSearchHits } from './parse';

const fixturesDir = dirname(fileURLToPath(import.meta.url));
const searchHits = parseEpcSearchHits(
  JSON.parse(
    readFileSync(join(fixturesDir, 'fixtures', 'domestic-search.json'), 'utf8'),
  ),
);

describe('resolveSurveyLookup', () => {
  it('prefers stored survey fields, then client, then title postcode', () => {
    expect(
      resolveSurveyLookup({
        stored: {
          address: '12 Example Street',
          postcode: 'm204ap',
          uprn: '000001234567',
          latitude: 53.43,
          longitude: -2.23,
        },
        clientAddress: 'Other House, LS1 4AP',
        title: 'Walkaround',
      }),
    ).toEqual({
      address: '12 Example Street',
      postcode: 'M20 4AP',
      uprn: '1234567',
      latitude: 53.43,
      longitude: -2.23,
    });

    expect(
      resolveSurveyLookup({
        title: '14 Union Street, LS1 4AP',
      }),
    ).toEqual({
      address: '14 Union Street, LS1 4AP',
      postcode: 'LS1 4AP',
      uprn: null,
      latitude: null,
      longitude: null,
    });
  });
});

describe('rankEpcHits', () => {
  it('ranks the UPRN + street match above a neighbour and an older flat', () => {
    const ranked = rankEpcHits(searchHits, {
      address: '12 Example Street, Manchester',
      postcode: 'M20 4AP',
      uprn: '10094703381',
      latitude: null,
      longitude: null,
    });

    expect(ranked[0]?.certificateNumber).toBe('1111-2222-3333-4444-5555');
    expect(ranked[0]?.matchScore).toBeGreaterThan(ranked[1]?.matchScore ?? 0);
    expect(
      isHighConfidenceEpcMatch(ranked[0]!, {
        address: '12 Example Street',
        postcode: 'M20 4AP',
        uprn: '10094703381',
        latitude: null,
        longitude: null,
      }),
    ).toBe(true);
  });

  it('still prefers the matching house number when there is no UPRN', () => {
    const ranked = rankEpcHits(searchHits, {
      address: '14 Example Street',
      postcode: 'M20 4AP',
      uprn: null,
      latitude: null,
      longitude: null,
    });

    expect(ranked[0]?.certificateNumber).toBe('0000-1672-0000-1732-0000');
    expect(tokenizeAddress('12 Example Street')).toContain('12');
  });
});
