import { describe, expect, it } from 'vitest';

import {
  applyAudienceFilters,
  parseAudienceListFilters,
} from './campaign-audience-filters';

const people = [
  {
    email: 'ada@agency.com',
    displayName: 'Ada Lovelace',
    consentedAt: '2026-01-15T00:00:00.000Z',
    createdAt: '2026-01-15T00:00:00.000Z',
    clientType: 'occupier',
    companyName: 'Analytical Engines',
  },
  {
    email: 'bob@gmail.com',
    displayName: 'Bob',
    consentedAt: '2025-06-01T00:00:00.000Z',
    createdAt: '2025-06-01T00:00:00.000Z',
    clientType: 'investor',
    companyName: null,
  },
];

describe('campaign audience filters', () => {
  it('defaults invalid filters to subscribers / all / no rules', () => {
    expect(parseAudienceListFilters(null)).toEqual({
      source: 'subscribers',
      matchMode: 'all',
      rules: [],
    });
  });

  it('matches email domain and has-company with ALL mode', () => {
    const matched = applyAudienceFilters(
      people,
      parseAudienceListFilters({
        source: 'clients',
        matchMode: 'all',
        rules: [
          { field: 'email_domain', op: 'eq', value: 'agency.com' },
          { field: 'has_company', op: 'eq', value: 'yes' },
        ],
      }),
    );
    expect(matched.map((row) => row.email)).toEqual(['ada@agency.com']);
  });

  it('matches ANY mode across email and name', () => {
    const matched = applyAudienceFilters(
      people,
      parseAudienceListFilters({
        source: 'subscribers',
        matchMode: 'any',
        rules: [
          { field: 'email', op: 'contains', value: 'gmail' },
          { field: 'display_name', op: 'contains', value: 'lovelace' },
        ],
      }),
    );
    expect(matched).toHaveLength(2);
  });

  it('filters subscribed_after dates', () => {
    const matched = applyAudienceFilters(
      people,
      parseAudienceListFilters({
        source: 'subscribers',
        matchMode: 'all',
        rules: [{ field: 'subscribed_after', op: 'gte', value: '2026-01-01' }],
      }),
    );
    expect(matched.map((row) => row.email)).toEqual(['ada@agency.com']);
  });
});
