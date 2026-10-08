import { describe, expect, it } from 'vitest';

import {
  type RightmoveReferenceIndex,
  classifyRightmoveReference,
  extractRightmoveBranchProperties,
  readRightmoveBranchTotalPages,
  rightmoveBranchPropertyRemovable,
} from '../rightmove-branch-audit-shared';

describe('extractRightmoveBranchProperties', () => {
  it('reads reference-keyed link maps and keeps the building display URL', () => {
    const properties = extractRightmoveBranchProperties({
      meta: { traceId: 't' },
      data: [
        {
          links: {
            self: { building: { REF_A: '/v2/property/commercial/1' } },
            display: {
              building: { REF_A: '/commercial-property/1' },
              spaces: { SPACE_1: '/properties/9' },
            },
          },
        },
        {
          links: {
            self: { building: { REF_B: '/v2/property/commercial/2' } },
          },
        },
      ],
    });

    expect(properties).toEqual([
      {
        reference: 'REF_A',
        displayUrl: 'https://www.rightmove.co.uk/commercial-property/1',
      },
      { reference: 'REF_B', displayUrl: null },
    ]);
  });

  it('reads plain reference fields and de-duplicates', () => {
    const properties = extractRightmoveBranchProperties({
      content: [
        { reference: '332576' },
        { externalReference: 'abc-sale' },
        { reference: '332576' },
      ],
      totalPages: 1,
    });
    expect(properties.map((p) => p.reference)).toEqual(['332576', 'abc-sale']);
  });

  it('skips space references inside a building', () => {
    const properties = extractRightmoveBranchProperties({
      data: {
        property: {
          reference: 'BUILDING',
          spaces: [{ reference: 'SPACE_1' }, { reference: 'SPACE_2' }],
        },
      },
    });
    expect(properties.map((p) => p.reference)).toEqual(['BUILDING']);
  });

  it('returns nothing for empty or unexpected responses', () => {
    expect(extractRightmoveBranchProperties(null)).toEqual([]);
    expect(extractRightmoveBranchProperties({ data: {} })).toEqual([]);
  });
});

describe('readRightmoveBranchTotalPages', () => {
  it('finds totalPages at the top level or under page/meta', () => {
    expect(readRightmoveBranchTotalPages({ totalPages: 3 })).toBe(3);
    expect(readRightmoveBranchTotalPages({ page: { totalPages: 2 } })).toBe(2);
    expect(readRightmoveBranchTotalPages({ meta: {} })).toBeNull();
  });
});

describe('classifyRightmoveReference', () => {
  const live = { id: 'l1', name: 'Live unit', status: 'marketing' };
  const let_ = { id: 'l2', name: 'Let unit', status: 'let' };
  const index: RightmoveReferenceIndex = {
    ozerReferences: new Map([
      ['l1', { listing: live, intendedLive: true }],
      ['l1-sale', { listing: live, intendedLive: true }],
      ['l2', { listing: let_, intendedLive: false }],
    ]),
    katoReferences: new Map([['332576', live]]),
  };

  it('keeps Ozer-published on-market references, including the sale side', () => {
    expect(classifyRightmoveReference('l1', index).kind).toBe('ozer');
    expect(classifyRightmoveReference('l1-sale', index).kind).toBe('ozer');
    expect(rightmoveBranchPropertyRemovable('ozer')).toBe(false);
  });

  it('flags Ozer references that should be off Rightmove', () => {
    expect(classifyRightmoveReference('l2', index)).toEqual({
      kind: 'ozer_off_market',
      listing: let_,
    });
  });

  it('matches old Kato references to their Ozer disposal', () => {
    expect(classifyRightmoveReference('332576', index)).toEqual({
      kind: 'kato_copy',
      listing: live,
    });
  });

  it('marks anything else as unknown and removable', () => {
    expect(classifyRightmoveReference('999999', index)).toEqual({
      kind: 'unknown',
      listing: null,
    });
    expect(rightmoveBranchPropertyRemovable('unknown')).toBe(true);
  });
});
