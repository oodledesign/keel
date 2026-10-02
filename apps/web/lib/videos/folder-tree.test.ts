import { describe, expect, it } from 'vitest';

import { type FolderTreeRow, flattenFolderTree } from './folder-tree';

const row = (
  id: string,
  name: string,
  parent: string | null,
): FolderTreeRow => ({ id, name, parent_folder_id: parent });

describe('flattenFolderTree', () => {
  it('returns just the root when it has no children', () => {
    expect(flattenFolderTree('a', [row('a', 'A', null)])).toEqual([
      { id: 'a', path: null },
    ]);
  });

  it('includes nested descendants with relative paths, siblings sorted', () => {
    const rows = [
      row('a', 'Root', null),
      row('c', 'Zebra', 'a'),
      row('b', 'Alpha', 'a'),
      row('d', 'March', 'b'),
    ];

    expect(flattenFolderTree('a', rows)).toEqual([
      { id: 'a', path: null },
      { id: 'b', path: 'Alpha' },
      { id: 'd', path: 'Alpha / March' },
      { id: 'c', path: 'Zebra' },
    ]);
  });

  it('ignores folders outside the shared subtree (siblings, parents)', () => {
    const rows = [
      row('top', 'Top', null),
      row('shared', 'Shared', 'top'),
      row('other', 'Other', 'top'),
      row('inside', 'Inside', 'shared'),
      row('elsewhere', 'Elsewhere', 'other'),
    ];

    const ids = flattenFolderTree('shared', rows).map((entry) => entry.id);

    expect(ids).toEqual(['shared', 'inside']);
  });

  it('does not loop or duplicate on cyclic data', () => {
    const rows = [row('a', 'A', 'c'), row('b', 'B', 'a'), row('c', 'C', 'b')];

    const ids = flattenFolderTree('a', rows).map((entry) => entry.id);

    expect(ids).toEqual(['a', 'b', 'c']);
  });
});
