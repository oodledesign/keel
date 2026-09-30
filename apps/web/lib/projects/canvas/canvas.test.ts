import { describe, expect, it } from 'vitest';

import {
  containerAt,
  itemsInsideContainer,
  pickConnectorHandles,
} from './canvas-geometry';
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
  arrangeCanvasByPhase,
  arrangeTeamSection,
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
import {
  MARKETING_TEMPLATE,
  buildSectionTemplate,
  sectionTemplateSize,
} from './canvas-templates';
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
  contacts: [{ id: 'k1' }],
  docs: [{ id: 'd1' }],
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
    expect(creates).toHaveLength(12);

    const byRef = new Map(creates.map((c) => [`${c.kind}:${c.refId}`, c]));
    const phase = byRef.get('phase:p1')!;
    for (const taskId of ['t1', 't2']) {
      const task = byRef.get(`task:${taskId}`)!;
      expect(task.x).toBeGreaterThan(phase.x);
      expect(task.y).toBeGreaterThan(phase.y);
      expect(task.y + task.h!).toBeLessThanOrEqual(phase.y + phase.h!);
    }
    expect(byRef.get('client:c1')!.y).toBeLessThan(phase.y);
    expect(byRef.get('contact:k1')!.y).toBe(byRef.get('client:c1')!.y);
    expect(byRef.get('note:n1')!.y).toBeGreaterThan(phase.y + phase.h!);
    expect(byRef.get('doc:d1')!.x).toBeGreaterThan(phase.x);
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

describe('arrangeCanvasByPhase', () => {
  const linked = (
    kind: CanvasItem['kind'],
    refId: string,
    x: number,
    y: number,
    size: { w: number; h: number } = { w: 280, h: 76 },
  ) =>
    item({
      id: linkedCanvasItemId(PROJECT, kind as 'task', refId),
      kind,
      refId,
      x,
      y,
      ...size,
    });

  it('moves loose task cards into their phase columns and grows the phase', () => {
    const phase = linked('phase', 'p1', 1000, 0, { w: 320, h: 260 });
    const tasks = ['t1', 't2'].map((id, index) =>
      linked('task', id, 0, index * 100),
    );
    const { creates, updates } = arrangeCanvasByPhase(PROJECT, entities, [
      phase,
      ...tasks,
    ]);

    expect(creates).toHaveLength(0);
    const byRef = new Map(updates.map((u) => [u.refId, u]));
    const t1 = byRef.get('t1')!;
    const t2 = byRef.get('t2')!;
    expect(t1.x).toBe(1020);
    expect(t2.y).toBeGreaterThan(t1.y);
    for (const task of [t1, t2]) {
      expect(itemsInsideContainer(phase, [task])).toHaveLength(1);
    }
  });

  it('adds missing phases that have tasks on the canvas, in board order', () => {
    const tasks = [linked('task', 't1', 0, 0), linked('task', 't3', 0, 100)];
    const { creates, updates } = arrangeCanvasByPhase(PROJECT, entities, tasks);
    expect(creates.map((c) => c.refId)).toEqual(['p1', 'p2']);
    const [p1, p2] = creates;
    expect(p2!.x).toBeGreaterThan(p1!.x);
    const t3 = updates.find((u) => u.refId === 't3')!;
    expect(t3.x).toBeGreaterThanOrEqual(p2!.x);
  });

  it('carries items inside a phase and pushes overlapping items aside', () => {
    const phase = linked('phase', 'p1', 500, 500, { w: 320, h: 260 });
    const task = linked('task', 't1', 0, 0);
    const sticky = item({ id: 's', x: 560, y: 600 });
    const blocker = item({ id: 'b', x: 400, y: 420, w: 50, h: 100 });
    const phase2 = linked('phase', 'p2', 0, 500, { w: 320, h: 260 });
    const { updates } = arrangeCanvasByPhase(PROJECT, entities, [
      phase2,
      phase,
      task,
      sticky,
      blocker,
    ]);
    const byId = new Map(updates.map((u) => [u.id, u]));
    const movedPhase = byId.get(phase.id)!;
    expect(movedPhase.x).toBe(0);
    expect(byId.get('s')!.x).toBe(sticky.x + (movedPhase.x - phase.x));
    const movedP2 = byId.get(phase2.id)!;
    expect(byId.get('b')!.x).toBeGreaterThanOrEqual(
      movedP2.x + (movedP2.w ?? 0),
    );
  });
});

describe('arrangeTeamSection', () => {
  const section = { id: 'team-frame', zIndex: 5 };

  it('creates a team section holding the client, contacts and members', () => {
    const { creates, updates } = arrangeTeamSection(
      PROJECT,
      entities,
      [],
      section,
    );
    expect(updates).toEqual([]);
    const frame = creates.find((c) => c.id === section.id)!;
    expect(frame.kind).toBe('frame');
    expect(frame.data.preset).toBe('team');
    const people = creates.filter((c) => c.id !== section.id);
    expect(people.map((c) => `${c.kind}:${c.refId}`).sort()).toEqual([
      'client:c1',
      'contact:k1',
      'member:m1',
    ]);
    expect(itemsInsideContainer(frame, people)).toHaveLength(3);
  });

  it('reuses and grows an existing team section and pushes blockers down', () => {
    const first = arrangeTeamSection(PROJECT, entities, [], section).creates;
    const frame = first.find((c) => c.id === section.id)!;
    const blocker = item({
      id: 'b',
      x: frame.x + 10,
      y: frame.y + frame.h! + 10,
    });
    const more = {
      ...entities,
      members: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }],
    };
    const { creates, updates } = arrangeTeamSection(
      PROJECT,
      more,
      [...first, blocker],
      { id: 'unused', zIndex: 9 },
    );
    expect(creates.map((c) => c.refId).sort()).toEqual(['m2', 'm3', 'm4']);
    const grown = updates.find((u) => u.id === section.id)!;
    expect(grown.h!).toBeGreaterThan(frame.h!);
    const movedBlocker = updates.find((u) => u.id === 'b')!;
    expect(movedBlocker.y).toBeGreaterThanOrEqual(grown.y + grown.h!);
  });
});

describe('buildSectionTemplate', () => {
  it('builds an outer section with an area and prompt sticky per area', () => {
    let n = 0;
    const created = buildSectionTemplate(
      MARKETING_TEMPLATE,
      { x: 100, y: 200 },
      { container: 3, item: 10 },
      () => `id${n++}`,
    );
    const [outer, ...rest] = created;
    const size = sectionTemplateSize(MARKETING_TEMPLATE);
    expect(outer).toMatchObject({
      kind: 'frame',
      x: 100,
      y: 200,
      w: size.w,
      h: size.h,
      zIndex: 3,
    });
    expect(outer!.data.preset).toBe('marketing');
    const areas = rest.filter((c) => c.kind === 'frame');
    const stickies = rest.filter((c) => c.kind === 'sticky');
    expect(areas).toHaveLength(MARKETING_TEMPLATE.areas.length);
    expect(stickies).toHaveLength(MARKETING_TEMPLATE.areas.length);
    expect(itemsInsideContainer(outer!, areas)).toHaveLength(areas.length);
    areas.forEach((area, index) => {
      expect(area.zIndex).toBe(4);
      expect(itemsInsideContainer(area, [stickies[index]!])).toHaveLength(1);
    });
    expect(new Set(created.map((c) => c.id)).size).toBe(created.length);
  });
});

describe('containerAt', () => {
  it('picks the smallest container under the point', () => {
    const big = item({ id: 'big', kind: 'frame', w: 1000, h: 1000 });
    const small = item({ id: 'small', kind: 'phase', x: 100, y: 100 });
    expect(containerAt({ x: 150, y: 150 }, [big, small])?.id).toBe('small');
    expect(containerAt({ x: 500, y: 500 }, [big, small])?.id).toBe('big');
    expect(
      containerAt({ x: 150, y: 150 }, [big, small], { kinds: ['frame'] })?.id,
    ).toBe('big');
    expect(containerAt({ x: 2000, y: 0 }, [big, small])).toBeNull();
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
