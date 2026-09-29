import { describe, expect, it } from 'vitest';

import { itemsInsideContainer, pickConnectorHandles } from './canvas-geometry';
import {
  applyCanvasChanges,
  emptyCanvasHistory,
  partitionCanvasChanges,
  pushCanvasHistory,
  redoCanvasHistory,
  undoCanvasHistory,
} from './canvas-history';
import { linkedCanvasItemId } from './canvas-ids';
import {
  type CanvasLinkedEntities,
  layoutUnplacedLinkedItems,
  orphanedLinkedItems,
  unplacedLinkedRefs,
} from './canvas-layout';
import {
  canConnectCanvasItems,
  connectorsTouching,
  mergeCanvasItems,
  removeCanvasItems,
} from './canvas-merge';
import {
  canvasPathToSvg,
  normalizeCanvasStroke,
  simplifyCanvasPath,
} from './canvas-path';
import type { CanvasItem } from './canvas-types';

const PROJECT = '11111111-1111-4111-8111-111111111111';

function item(overrides: Partial<CanvasItem> & { id: string }): CanvasItem {
  return {
    kind: 'sticky',
    refId: null,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    zIndex: 0,
    data: {},
    updatedAt: '2026-09-29T10:00:00.000Z',
    updatedBy: null,
    ...overrides,
  };
}

const entities: CanvasLinkedEntities = {
  phases: [{ id: 'p1' }, { id: 'p2' }],
  tasks: [
    { id: 't1', phaseId: 'p1' },
    { id: 't2', phaseId: 'p1' },
    { id: 't3', phaseId: 'p2' },
    { id: 't4', phaseId: null },
  ],
  members: [{ id: 'm1' }],
  clientId: 'c1',
  notes: [
    { id: 'n1', phaseId: 'p1' },
    { id: 'n2', phaseId: null },
  ],
};

describe('linkedCanvasItemId', () => {
  it('is stable, UUID-shaped and distinct per ref', () => {
    const a = linkedCanvasItemId(PROJECT, 'task', 't1');
    expect(a).toBe(linkedCanvasItemId(PROJECT, 'task', 't1'));
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(a).not.toBe(linkedCanvasItemId(PROJECT, 'task', 't2'));
    expect(a).not.toBe(linkedCanvasItemId(PROJECT, 'phase', 't1'));
  });
});

describe('layoutUnplacedLinkedItems', () => {
  it('lays out everything on an empty canvas with tasks inside their phase', () => {
    const { creates, updates } = layoutUnplacedLinkedItems(
      PROJECT,
      entities,
      [],
    );
    expect(updates).toEqual([]);
    expect(creates).toHaveLength(10);

    const byRef = new Map(creates.map((c) => [`${c.kind}:${c.refId}`, c]));
    const phase = byRef.get('phase:p1')!;
    for (const taskId of ['t1', 't2']) {
      const task = byRef.get(`task:${taskId}`)!;
      expect(task.x).toBeGreaterThan(phase.x);
      expect(task.y).toBeGreaterThan(phase.y);
      expect(task.y + task.h!).toBeLessThanOrEqual(phase.y + phase.h!);
    }
    expect(byRef.get('client:c1')!.y).toBeLessThan(phase.y);
    expect(byRef.get('note:n1')!.y).toBeGreaterThan(phase.y + phase.h!);
  });

  it('slots a new task into its placed phase and grows the phase', () => {
    const initial = layoutUnplacedLinkedItems(PROJECT, entities, []).creates;
    const extraTasks = Array.from({ length: 3 }, (_, i) => ({
      id: `new${i}`,
      phaseId: 'p2',
    }));
    const next = { ...entities, tasks: [...entities.tasks, ...extraTasks] };

    const { creates, updates } = layoutUnplacedLinkedItems(
      PROJECT,
      next,
      initial,
    );
    expect(creates.map((c) => c.refId)).toEqual(['new0', 'new1', 'new2']);
    const phase = initial.find((c) => c.refId === 'p2')!;
    expect(creates.every((c) => c.x === phase.x + 20)).toBe(true);
    expect(creates[1]!.y).toBeGreaterThan(creates[0]!.y);
    expect(updates).toHaveLength(1);
    expect(updates[0]!.h!).toBeGreaterThan(phase.h!);
  });

  it('reports unplaced and orphaned linked items', () => {
    const initial = layoutUnplacedLinkedItems(PROJECT, entities, []).creates;
    expect(unplacedLinkedRefs(entities, initial)).toEqual([]);

    const fewer = { ...entities, tasks: entities.tasks.slice(1) };
    expect(orphanedLinkedItems(fewer, initial).map((i) => i.refId)).toEqual([
      't1',
    ]);
  });
});

describe('mergeCanvasItems', () => {
  const base = item({ id: 'a', x: 1 });

  it('keeps the newer copy by updated_at unless forced', () => {
    const older = { ...base, x: 99, updatedAt: '2026-09-29T09:00:00.000Z' };
    const newer = { ...base, x: 42, updatedAt: '2026-09-29T11:00:00.000Z' };
    expect(mergeCanvasItems([base], [older])[0]!.x).toBe(1);
    expect(mergeCanvasItems([base], [newer])[0]!.x).toBe(42);
    expect(mergeCanvasItems([base], [older], { force: true })[0]!.x).toBe(99);
  });

  it('returns the same array when nothing changes', () => {
    const list = [base];
    expect(mergeCanvasItems(list, [base])).toBe(list);
    expect(removeCanvasItems(list, ['missing'])).toBe(list);
  });

  it('adds unknown items and removes by id', () => {
    const merged = mergeCanvasItems([base], [item({ id: 'b' })]);
    expect(merged.map((i) => i.id)).toEqual(['a', 'b']);
    expect(removeCanvasItems(merged, ['a']).map((i) => i.id)).toEqual(['b']);
  });
});

describe('connectors', () => {
  const a = item({ id: 'a' });
  const b = item({ id: 'b', x: 400 });
  const link = item({
    id: 'c',
    kind: 'connector',
    data: { source: 'a', target: 'b' },
  });

  it('validates new connections', () => {
    expect(canConnectCanvasItems([a, b], 'a', 'b')).toBe(true);
    expect(canConnectCanvasItems([a, b], 'a', 'a')).toBe(false);
    expect(canConnectCanvasItems([a, b], 'a', 'zzz')).toBe(false);
    expect(canConnectCanvasItems([a, b, link], 'a', 'b')).toBe(false);
    expect(canConnectCanvasItems([a, b, link], 'b', 'a')).toBe(true);
    expect(canConnectCanvasItems([a, b, link], 'a', 'c')).toBe(false);
  });

  it('finds connectors attached to removed items', () => {
    expect(connectorsTouching([a, b, link], ['b']).map((i) => i.id)).toEqual([
      'c',
    ]);
  });

  it('attaches arrows to facing sides', () => {
    expect(pickConnectorHandles(a, b)).toEqual({
      sourceHandle: 'right',
      targetHandle: 'left',
    });
    expect(pickConnectorHandles(a, item({ id: 'd', y: 500 }))).toEqual({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    });
  });
});

describe('itemsInsideContainer', () => {
  it('returns items centred inside, excluding larger containers', () => {
    const frame = item({ id: 'f', kind: 'frame', w: 500, h: 400 });
    const inside = item({ id: 'in', x: 50, y: 50 });
    const outside = item({ id: 'out', x: 900, y: 900 });
    const bigger = item({ id: 'big', kind: 'phase', w: 800, h: 800 });
    const arrow = item({ id: 'arrow', kind: 'connector' });
    expect(
      itemsInsideContainer(frame, [frame, inside, outside, bigger, arrow]).map(
        (i) => i.id,
      ),
    ).toEqual(['in']);
  });
});

describe('canvas history', () => {
  const a = item({ id: 'a', x: 0 });
  const moved = { ...a, x: 50 };
  const created = item({ id: 'new' });

  it('undoes and redoes moves, creates and deletes', () => {
    let items = [a];
    let history = emptyCanvasHistory();

    const move = [{ before: a, after: moved }];
    items = applyCanvasChanges(items, move);
    history = pushCanvasHistory(history, move);

    const create = [{ before: null, after: created }];
    items = applyCanvasChanges(items, create);
    history = pushCanvasHistory(history, create);
    expect(items.map((i) => i.id)).toEqual(['a', 'new']);

    const undoCreate = undoCanvasHistory(history)!;
    items = applyCanvasChanges(items, undoCreate.changes);
    history = undoCreate.history;
    expect(items.map((i) => i.id)).toEqual(['a']);
    expect(partitionCanvasChanges(undoCreate.changes)).toEqual({
      upserts: [],
      deletes: ['new'],
    });

    const undoMove = undoCanvasHistory(history)!;
    items = applyCanvasChanges(items, undoMove.changes);
    history = undoMove.history;
    expect(items[0]!.x).toBe(0);
    expect(undoCanvasHistory(history)).toBeNull();

    const redoMove = redoCanvasHistory(history)!;
    items = applyCanvasChanges(items, redoMove.changes);
    expect(items[0]!.x).toBe(50);
  });

  it('clears redo after a new edit', () => {
    let history = pushCanvasHistory(emptyCanvasHistory(), [
      { before: a, after: moved },
    ]);
    history = undoCanvasHistory(history)!.history;
    expect(history.future).toHaveLength(1);
    history = pushCanvasHistory(history, [{ before: null, after: created }]);
    expect(history.future).toHaveLength(0);
  });
});

describe('freehand paths', () => {
  it('drops collinear points', () => {
    const line: Array<[number, number]> = Array.from({ length: 50 }, (_, i) => [
      i,
      i * 2,
    ]);
    expect(simplifyCanvasPath(line)).toEqual([
      [0, 0],
      [49, 98],
    ]);
  });

  it('keeps corners', () => {
    const corner: Array<[number, number]> = [
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 5],
      [10, 10],
    ];
    expect(simplifyCanvasPath(corner)).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
  });

  it('normalises a stroke to padded, relative points', () => {
    const stroke = normalizeCanvasStroke(
      [
        [100, 200],
        [150, 260],
        [200, 200],
      ],
      4,
    );
    expect(stroke.x).toBeLessThan(100);
    expect(stroke.y).toBeLessThan(200);
    expect(stroke.w).toBeGreaterThan(100);
    expect(stroke.points.every(([x, y]) => x >= 0 && y >= 0)).toBe(true);
  });

  it('caps very long strokes', () => {
    const zigzag: Array<[number, number]> = Array.from(
      { length: 20_000 },
      (_, i) => [i, i % 2 === 0 ? 0 : 50],
    );
    const started = performance.now();
    const stroke = normalizeCanvasStroke(zigzag, 2);
    expect(stroke.points.length).toBeLessThanOrEqual(4000);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(
      normalizeCanvasStroke(zigzag, 2, 500).points.length,
    ).toBeLessThanOrEqual(500);
  });

  it('renders an SVG path', () => {
    expect(canvasPathToSvg([])).toBe('');
    expect(
      canvasPathToSvg([
        [0, 0],
        [10, 10],
        [20, 0],
      ]),
    ).toBe('M0,0Q10,10 15,5L20,0');
  });
});
