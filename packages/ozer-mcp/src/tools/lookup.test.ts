import { describe, expect, it } from 'vitest';

import {
  clientDisplayName,
  composeContactFullName,
  contactDisplayName,
  filterContactsByQuery,
  findBestNameMatch,
  resolveClientStoredDisplayName,
} from './lookup';

describe('findBestNameMatch', () => {
  const rows = [
    { id: '1', name: 'Bracketts', account_id: 'a' },
    { id: '2', name: 'Oodle Design', account_id: 'a' },
    { id: '3', name: 'Warm Welcome', account_id: 'a' },
  ];

  it('returns a high-confidence exact match', () => {
    expect(findBestNameMatch('bracketts', rows)).toMatchObject({
      id: '1',
      confidence: 'high',
    });
  });

  it('returns a medium partial match and ignores short needles', () => {
    expect(findBestNameMatch('oodle', rows)?.confidence).toBe('medium');
    expect(findBestNameMatch('oo', rows)).toBeNull();
  });
});

describe('clientDisplayName', () => {
  it('prefers display_name then first+last then company', () => {
    expect(
      clientDisplayName({
        id: '1',
        display_name: '  Bracketts  ',
        company_name: 'Ignore',
      }),
    ).toBe('Bracketts');
    expect(
      clientDisplayName({
        id: '2',
        first_name: 'Dan',
        last_name: 'Oodle',
      }),
    ).toBe('Dan Oodle');
  });
});

describe('resolveClientStoredDisplayName', () => {
  it('uses person name for individuals and company for businesses', () => {
    expect(
      resolveClientStoredDisplayName({
        clientType: 'individual',
        companyName: 'Ignore',
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    ).toBe('Ada Lovelace');
    expect(
      resolveClientStoredDisplayName({
        clientType: 'business',
        companyName: 'Bracketts',
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    ).toBe('Bracketts');
  });
});

describe('contact names', () => {
  it('prefers first+last over full_name', () => {
    expect(
      composeContactFullName({
        firstName: 'Jane',
        lastName: 'Doe',
        fullName: 'Ignored',
      }),
    ).toBe('Jane Doe');
    expect(
      contactDisplayName({
        id: '1',
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        industry: 'Property',
      }),
    ).toBe('Jane Doe');
  });

  it('falls back to email when no name is stored', () => {
    expect(
      contactDisplayName({
        id: '2',
        email: 'jane@example.com',
      }),
    ).toBe('jane@example.com');
  });
});

describe('filterContactsByQuery', () => {
  const rows = [
    {
      id: '1',
      name: 'Jane Doe',
      account_id: 'a',
      row: {
        id: '1',
        full_name: 'Jane Doe',
        email: 'jane@bracketts.com',
        industry: 'Retail',
      },
    },
    {
      id: '2',
      name: 'Sam Patel',
      account_id: 'a',
      row: {
        id: '2',
        full_name: 'Sam Patel',
        company_name: 'Oodle Design',
        industry: 'Property',
      },
    },
  ];

  it('matches email and industry, not only display name', () => {
    expect(
      filterContactsByQuery(rows, 'bracketts', 10).map((row) => row.id),
    ).toEqual(['1']);
    expect(
      filterContactsByQuery(rows, 'property', 10).map((row) => row.id),
    ).toEqual(['2']);
  });
});
