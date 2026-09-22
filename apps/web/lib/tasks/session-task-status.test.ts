import { describe, expect, it } from 'vitest';

import {
  applySessionTaskStatuses,
  omitHiddenItems,
} from './session-task-status';

describe('omitHiddenItems', () => {
  it('returns the same list when nothing is hidden', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(omitHiddenItems(items, new Set())).toEqual(items);
  });

  it('drops hidden ids immediately', () => {
    expect(
      omitHiddenItems([{ id: 'a' }, { id: 'b' }, { id: 'c' }], new Set(['b'])),
    ).toEqual([{ id: 'a' }, { id: 'c' }]);
  });
});

describe('applySessionTaskStatuses', () => {
  it('overlays a session status onto the server row', () => {
    const server = [
      { id: 'a', status: 'pending', title: 'Write brief' },
      { id: 'b', status: 'pending', title: 'Call client' },
    ];

    expect(
      applySessionTaskStatuses(server, new Map([['a', 'completed']])),
    ).toEqual([
      { id: 'a', status: 'completed', title: 'Write brief' },
      { id: 'b', status: 'pending', title: 'Call client' },
    ]);
  });

  it('keeps a completed task the server list dropped', () => {
    const previous = [{ id: 'a', status: 'completed', title: 'Write brief' }];

    expect(
      applySessionTaskStatuses([], new Map([['a', 'completed']]), previous),
    ).toEqual(previous);
  });

  it('updates a nested subtask and reattaches one the server omitted', () => {
    const server = [
      {
        id: 'parent',
        status: 'pending',
        subtasks: [{ id: 'child', status: 'pending', parentTaskId: 'parent' }],
      },
    ];
    const previous = [
      {
        id: 'parent',
        status: 'pending',
        subtasks: [
          { id: 'child', status: 'pending', parentTaskId: 'parent' },
          { id: 'gone', status: 'completed', parentTaskId: 'parent' },
        ],
      },
    ];

    expect(
      applySessionTaskStatuses(
        server,
        new Map([
          ['child', 'completed'],
          ['gone', 'completed'],
        ]),
        previous,
      ),
    ).toEqual([
      {
        id: 'parent',
        status: 'pending',
        subtasks: [
          { id: 'child', status: 'completed', parentTaskId: 'parent' },
          { id: 'gone', status: 'completed', parentTaskId: 'parent' },
        ],
      },
    ]);
  });

  it('does not duplicate a dropped child already nested on a dropped parent', () => {
    const previous = [
      {
        id: 'parent',
        status: 'completed',
        subtasks: [
          { id: 'child', status: 'completed', parentTaskId: 'parent' },
        ],
      },
    ];

    const merged = applySessionTaskStatuses(
      [],
      new Map([
        ['parent', 'completed'],
        ['child', 'completed'],
      ]),
      previous,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.subtasks).toHaveLength(1);
  });
});
