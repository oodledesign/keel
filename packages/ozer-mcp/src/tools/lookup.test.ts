import { describe, expect, it } from 'vitest';

import { clientDisplayName, findBestNameMatch } from './lookup';

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
