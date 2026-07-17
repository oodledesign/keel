import { describe, expect, it } from 'vitest';

import {
  fuzzyMatchByName,
  fuzzyMatchWorkspaceBySlugOrName,
  mapNameToId,
} from './fuzzy-match';

describe('fuzzyMatchByName', () => {
  const items = [
    { id: '1', name: 'Arcanum Digital' },
    { id: '2', name: 'Green Trees Ltd' },
    { id: '3', name: 'Greentrees Property' },
  ];

  it('prefers exact matches', () => {
    const matches = fuzzyMatchByName('Arcanum Digital', items);
    expect(matches[0]?.id).toBe('1');
    expect(matches[0]?.score).toBe(100);
  });

  it('matches partial queries', () => {
    const matches = fuzzyMatchByName('arcanum', items);
    expect(matches[0]?.id).toBe('1');
  });

  it('returns empty for unrelated queries', () => {
    expect(fuzzyMatchByName('zzzz', items)).toEqual([]);
  });
});

describe('fuzzyMatchWorkspaceBySlugOrName', () => {
  const workspaces = [
    { id: 'a', name: 'Green Trees', slug: 'greentrees' },
    { id: 'b', name: 'Arcanum', slug: 'arcanum' },
  ];

  it('matches slug exactly', () => {
    expect(fuzzyMatchWorkspaceBySlugOrName('greentrees', workspaces)?.id).toBe(
      'a',
    );
  });

  it('matches name case-insensitively', () => {
    expect(fuzzyMatchWorkspaceBySlugOrName('Arcanum', workspaces)?.id).toBe(
      'b',
    );
  });
});

describe('mapNameToId', () => {
  it('maps partial client names', () => {
    const rows = [{ id: 'c1', name: 'Bungalow renovation' }];
    expect(mapNameToId('bungalow', rows)).toBe('c1');
  });
});
