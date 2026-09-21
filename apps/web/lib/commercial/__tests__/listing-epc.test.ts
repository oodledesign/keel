import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseEpcSearchHits } from '~/lib/building-surveyor/epc/parse';

import {
  listingEpcFieldsFromCertificate,
  listingEpcFieldsFromSearchHit,
  listingEpcLookupFromAddress,
  mergeListingEpcOnRefresh,
  parseListingEpcPulledSnapshot,
} from '../listing-epc';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../building-surveyor/epc/fixtures',
);

describe('listingEpcLookupFromAddress', () => {
  it('joins listing address lines and normalises the postcode', () => {
    expect(
      listingEpcLookupFromAddress({
        addressLine1: '12 Example Street',
        addressLine2: 'Suite 2',
        town: 'Manchester',
        postcode: 'm204ap',
      }),
    ).toEqual({
      address: '12 Example Street, Suite 2, Manchester',
      postcode: 'M20 4AP',
      uprn: null,
    });
  });

  it('extracts a postcode from the name when the field is empty', () => {
    expect(
      listingEpcLookupFromAddress({
        name: 'Warehouse, LS1 4AP',
        addressLine1: 'King Street',
      }),
    ).toMatchObject({
      address: 'King Street',
      postcode: 'LS1 4AP',
    });
  });
});

describe('listingEpcFieldsFromSearchHit', () => {
  it('maps a GOV.UK search hit band onto listing EPC fields', () => {
    expect(
      listingEpcFieldsFromSearchHit({
        currentEnergyEfficiencyBand: 'd',
      }),
    ).toEqual({
      epcBand: 'D',
      epcRating: null,
    });
  });

  it('maps official search fixture rows onto listing columns', () => {
    const hits = parseEpcSearchHits(
      JSON.parse(
        readFileSync(join(fixturesDir, 'domestic-search.json'), 'utf8'),
      ) as unknown,
    );
    expect(listingEpcFieldsFromSearchHit(hits[0]!)).toEqual({
      epcBand: 'D',
      epcRating: null,
    });
    expect(listingEpcFieldsFromSearchHit(hits[1]!)).toEqual({
      epcBand: 'C',
      epcRating: null,
    });
  });

  it('returns empty fields when the hit has no band', () => {
    expect(
      listingEpcFieldsFromSearchHit({
        currentEnergyEfficiencyBand: null,
      }),
    ).toEqual({
      epcBand: null,
      epcRating: null,
    });
  });
});

describe('listingEpcFieldsFromCertificate', () => {
  it('maps certificate band and score onto listing columns', () => {
    expect(
      listingEpcFieldsFromCertificate({
        currentRating: 'C',
        currentScore: 68,
      }),
    ).toEqual({
      epcBand: 'C',
      epcRating: 68,
    });
  });

  it('keeps commercial asset ratings above 100', () => {
    expect(
      listingEpcFieldsFromCertificate({
        currentRating: 'B',
        currentScore: 125,
      }),
    ).toEqual({
      epcBand: 'B',
      epcRating: 125,
    });
  });
});

describe('mergeListingEpcOnRefresh', () => {
  it('takes the fresh pull when the user has not edited', () => {
    expect(
      mergeListingEpcOnRefresh({
        pulled: { epcBand: 'B', epcRating: 81 },
        current: { epcBand: 'C', epcRating: 68 },
        previousPulled: { epcBand: 'C', epcRating: 68 },
        preserveOverrides: true,
      }),
    ).toEqual({ epcBand: 'B', epcRating: 81 });
  });

  it('keeps a user-edited band and takes the new score', () => {
    expect(
      mergeListingEpcOnRefresh({
        pulled: { epcBand: 'B', epcRating: 81 },
        current: { epcBand: 'A', epcRating: 68 },
        previousPulled: { epcBand: 'C', epcRating: 68 },
        preserveOverrides: true,
      }),
    ).toEqual({ epcBand: 'A', epcRating: 81 });
  });

  it('overwrites on a new attach when overrides are not preserved', () => {
    expect(
      mergeListingEpcOnRefresh({
        pulled: { epcBand: 'D', epcRating: 50 },
        current: { epcBand: 'A', epcRating: 99 },
        previousPulled: { epcBand: 'C', epcRating: 68 },
        preserveOverrides: false,
      }),
    ).toEqual({ epcBand: 'D', epcRating: 50 });
  });
});

describe('parseListingEpcPulledSnapshot', () => {
  it('reads camelCase or snake_case snapshots', () => {
    expect(
      parseListingEpcPulledSnapshot({
        epc_band: 'E',
        epcRating: '72',
      }),
    ).toEqual({
      epcBand: 'E',
      epcRating: 72,
    });
  });
});
