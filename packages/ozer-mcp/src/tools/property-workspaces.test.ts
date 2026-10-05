import { describe, expect, it } from 'vitest';

import {
  COMMERCIAL_SPACE,
  SURVEYOR_SPACE,
  mapDisposal,
  pounds,
  safeSearch,
  scopeWipWorkspaces,
  scopeWorkspaces,
  updateWipDealSchema,
} from './property-workspaces';

const ws = (id: string, space_type: string | null) => ({
  id,
  name: id,
  slug: id,
  space_type,
  is_personal_account: false,
});

describe('property workspace tools', () => {
  const all = [
    ws('a', COMMERCIAL_SPACE),
    ws('b', SURVEYOR_SPACE),
    ws('c', 'work'),
  ];

  it('scopes to the right workspace types', () => {
    expect(scopeWorkspaces(all, COMMERCIAL_SPACE).map((w) => w.id)).toEqual([
      'a',
    ]);
    expect(scopeWipWorkspaces(all).map((w) => w.id)).toEqual(['a', 'b']);
    expect(() => scopeWorkspaces(all, COMMERCIAL_SPACE, 'c')).toThrow();
    expect(() => scopeWorkspaces([ws('c', 'work')], SURVEYOR_SPACE)).toThrow(
      /do not belong/,
    );
  });

  it('cleans search text and converts pence', () => {
    expect(safeSearch('a,b(c)%')).toBe('a b c');
    expect(pounds(12550)).toBe(125.5);
    expect(pounds(null)).toBeNull();
  });

  it('maps a disposal with pounds and names', () => {
    const out = mapDisposal(
      {
        id: '1',
        address_line_1: '1 High St',
        town: 'Leeds',
        postcode: 'LS1',
        asking_rent_pence: 2500000,
        assigned_to: 'u',
        status: 'marketing',
      },
      new Map([['u', 'Paul']]),
      new Map(),
    );
    expect(out.address).toBe('1 High St, Leeds, LS1');
    expect(out.asking_rent_gbp).toBe(25000);
    expect(out.assigned_to).toBe('Paul');
  });

  it('only allows known WIP stages', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(updateWipDealSchema.parse({ id, stage: 'billed' }).stage).toBe(
      'billed',
    );
    expect(() => updateWipDealSchema.parse({ id, stage: 'nope' })).toThrow();
  });
});
