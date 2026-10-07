import { describe, expect, it } from 'vitest';

import {
  applyAudienceFilters,
  parseAudienceListFilters,
} from './campaign-audience-filters';
import {
  applyCampaignMergeText,
  mergeValuesForRecipient,
} from './merge-fields';

describe('custom merge tags', () => {
  const merge = mergeValuesForRecipient({
    displayName: 'Alex Taylor',
    email: 'a@b.co',
    customFields: { budget: 500, vip: true },
  });

  it('fills custom tags and blanks unknown ones', () => {
    expect(
      applyCampaignMergeText(
        'Budget {{custom.budget}} VIP {{custom.vip}} x{{custom.nope}}x',
        merge,
      ),
    ).toBe('Budget 500 VIP Yes xx');
  });
});

describe('custom audience filters', () => {
  const filters = (rules: unknown[]) =>
    parseAudienceListFilters({ source: 'clients', rules });
  const subjects = [
    {
      email: 'a@x.co',
      displayName: 'A',
      customFields: { budget: 900, vip: true },
    },
    {
      email: 'b@x.co',
      displayName: 'B',
      customFields: { budget: 100, vip: false },
    },
    { email: 'c@x.co', displayName: 'C' },
  ];

  it('filters on numbers, booleans and ignores contacts without values', () => {
    expect(
      applyAudienceFilters(
        subjects,
        filters([{ field: 'custom:budget', op: 'gte', value: '500' }]),
      ).map((s) => s.email),
    ).toEqual(['a@x.co']);
    expect(
      applyAudienceFilters(
        subjects,
        filters([{ field: 'custom:vip', op: 'eq', value: 'no' }]),
      ).map((s) => s.email),
    ).toEqual(['b@x.co']);
  });

  it('rejects malformed custom field names', () => {
    expect(
      filters([{ field: 'custom:Bad Key', op: 'eq', value: 'x' }]).rules,
    ).toEqual([]);
  });
});
