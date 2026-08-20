import { describe, expect, it } from 'vitest';

import { type NavSearchItem, filterNavCatalog } from './filter-nav-catalog';

const items: NavSearchItem[] = [
  {
    id: 'other-client',
    label: 'Acme Ltd',
    category: 'Other workspace · Client',
    href: '/app/other/clients/1',
    keywords: ['client', 'Acme Ltd'],
  },
  {
    id: 'current-client',
    label: 'Acme Ltd',
    category: 'Current workspace · Client',
    href: '/app/oodle/clients/2',
    keywords: ['client', 'Acme Ltd'],
  },
];

describe('filterNavCatalog', () => {
  it('boosts matches in the current workspace', () => {
    const matches = filterNavCatalog(items, 'acme', 8, {
      preferAccountSlug: 'oodle',
    });

    expect(matches[0]?.id).toBe('current-client');
  });
});
