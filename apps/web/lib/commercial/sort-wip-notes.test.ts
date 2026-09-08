import { describe, expect, it } from 'vitest';

import { sortWipNotesNewestFirst } from './sort-wip-notes';

describe('sortWipNotesNewestFirst', () => {
  it('puts most recent createdAt first', () => {
    const sorted = sortWipNotesNewestFirst([
      { id: 'a', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', createdAt: '2026-03-01T00:00:00.000Z' },
      { id: 'c', createdAt: '2026-02-01T00:00:00.000Z' },
    ]);

    expect(sorted.map((note) => note.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input list', () => {
    const notes = [
      { id: 'a', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', createdAt: '2026-03-01T00:00:00.000Z' },
    ];

    sortWipNotesNewestFirst(notes);

    expect(notes.map((note) => note.id)).toEqual(['a', 'b']);
  });
});
