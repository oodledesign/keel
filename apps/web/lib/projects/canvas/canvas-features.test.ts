import { describe, expect, it } from 'vitest';

import { buildCanvasAiPrompt, parseCanvasAiResponse } from './canvas-ai';
import {
  layoutCanvasBoard,
  moveInOrder,
  planBoardDrop,
  reorderBoardTasks,
} from './canvas-board-layout';
import {
  canvasPasteOffset,
  copyCanvasItems,
  parseCanvasClipboard,
  pasteCanvasItems,
} from './canvas-clipboard';
import {
  activeMentionIds,
  groupCanvasComments,
  mentionQueryAt,
} from './canvas-comments';
import {
  effectiveLinkDisplay,
  linkDisplaySize,
  resolveEmbed,
} from './canvas-embed';
import { outlineCanvasSection, placeSectionNotes } from './canvas-fill';
import { parseGoogleDoc } from './canvas-google';
import { buildLinkedCanvasItem } from './canvas-layout';
import {
  canvasUrlFromText,
  isCanvasImageUrl,
  linkCardPreview,
} from './canvas-links';
import {
  buildTotalizer,
  computeMetricPace,
  formatMetricNumber,
  logMetricPoint,
  metricProgress,
  metricWeeklyChange,
  parseIsoDate,
  parseMetricNumber,
  projectMetricCount,
  toIsoDate,
} from './canvas-metric';
import { searchCanvasEntries } from './canvas-search';
import {
  CONTENT_CALENDAR_TEMPLATE,
  GOALS_TARGETS_TEMPLATE,
  PROJECT_BRIEF_TEMPLATE,
  buildSectionTemplate,
  nextMonday,
  sectionTemplateSize,
} from './canvas-templates';
import { buildCanvasTimeline } from './canvas-timeline';
import type { CanvasItem } from './canvas-types';

function ids(prefix: string) {
  let n = 0;
  return () => `${prefix}${n++}`;
}

function byId(items: CanvasItem[]) {
  return new Map(items.map((item) => [item.id, item]));
}

describe('nextMonday', () => {
  it('returns the Monday after the given day', () => {
    // Wednesday 30 Sep 2026
    expect(nextMonday(new Date(2026, 8, 30)).toDateString()).toBe(
      new Date(2026, 9, 5).toDateString(),
    );
    // A Monday moves a full week on
    expect(nextMonday(new Date(2026, 9, 5)).toDateString()).toBe(
      new Date(2026, 9, 12).toDateString(),
    );
  });
});

describe('content calendar template', () => {
  const created = buildSectionTemplate(
    CONTENT_CALENDAR_TEMPLATE,
    { x: 0, y: 0 },
    { container: 1, item: 1 },
    ids('c'),
    new Date(2026, 8, 30),
  );

  it('builds week headers, channel rows and a prompt per row', () => {
    const [outer, ...rest] = created;
    expect(outer).toMatchObject({
      kind: 'frame',
      ...sectionTemplateSize(CONTENT_CALENDAR_TEMPLATE),
    });
    expect(outer!.data.preset).toBe('content_calendar');
    const headers = rest.filter((item) => item.kind === 'text');
    expect(headers.map((item) => item.data.text)).toEqual([
      'w/c 5 Oct',
      'w/c 12 Oct',
      'w/c 19 Oct',
      'w/c 26 Oct',
    ]);
    expect(rest.filter((item) => item.kind === 'frame')).toHaveLength(
      CONTENT_CALENDAR_TEMPLATE.channels.length,
    );
    expect(rest.filter((item) => item.kind === 'sticky')).toHaveLength(
      CONTENT_CALENDAR_TEMPLATE.channels.length,
    );
  });

  it('outlines as a calendar with rows and weeks in order', () => {
    const outline = outlineCanvasSection(created, created[0]!.id);
    expect(outline?.layout).toBe('calendar');
    if (outline?.layout !== 'calendar') return;
    expect(outline.rows.map((row) => row.title)).toEqual(
      CONTENT_CALENDAR_TEMPLATE.channels.map((channel) => channel.title),
    );
    expect(outline.weeks.map((week) => week.label)[0]).toBe('w/c 5 Oct');
    expect(outline.rows[0]!.existing).toEqual([
      CONTENT_CALENDAR_TEMPLATE.channels[0]!.prompt,
    ]);
  });

  it('places cells under the right week column', () => {
    const outline = outlineCanvasSection(created, created[0]!.id);
    if (outline?.layout !== 'calendar') throw new Error('not a calendar');
    const row = outline.rows[1]!;
    const week = outline.weeks[2]!;
    const { creates } = placeSectionNotes(
      created,
      created[0]!.id,
      [{ areaId: row.id, weekId: week.id, text: 'Launch reel' }],
      { createId: ids('n'), zIndex: 50 },
    );
    const rowFrame = byId(created).get(row.id)!;
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatchObject({
      kind: 'sticky',
      x: week.x,
      y: rowFrame.y + 44,
      data: { text: 'Launch reel' },
    });
  });
});

describe('project brief template + fill', () => {
  const created = buildSectionTemplate(
    PROJECT_BRIEF_TEMPLATE,
    { x: 0, y: 0 },
    { container: 1, item: 1 },
    ids('b'),
  );
  const sectionId = created[0]!.id;

  it('outlines eight areas with their prompts', () => {
    const outline = outlineCanvasSection(created, sectionId);
    expect(outline?.layout).toBe('areas');
    if (outline?.layout !== 'areas') return;
    expect(outline.areas.map((area) => area.title)).toEqual(
      PROJECT_BRIEF_TEMPLATE.areas.map((area) => area.title),
    );
    expect(outline.areas[0]!.existing).toEqual([
      PROJECT_BRIEF_TEMPLATE.areas[0]!.prompt,
    ]);
  });

  it('stacks notes under existing ones, grows the area and pushes the one below', () => {
    const outline = outlineCanvasSection(created, sectionId);
    if (outline?.layout !== 'areas') throw new Error('not areas');
    const first = outline.areas[0]!;
    const below = outline.areas[4]!;
    const beside = outline.areas[1]!;
    const before = byId(created);
    const { creates, updates } = placeSectionNotes(
      created,
      sectionId,
      ['One', 'Two', 'Three'].map((text) => ({ areaId: first.id, text })),
      { createId: ids('n'), zIndex: 50 },
    );
    expect(creates).toHaveLength(3);
    const prompt = created.find(
      (item) =>
        item.kind === 'sticky' &&
        item.data.text === PROJECT_BRIEF_TEMPLATE.areas[0]!.prompt,
    )!;
    expect(creates[0]!.y).toBe(prompt.y + prompt.h! + 12);
    expect(creates[1]!.y).toBeGreaterThan(creates[0]!.y);

    const after = byId(updates);
    const grownArea = after.get(first.id)!;
    const areaBottom = grownArea.y + grownArea.h!;
    expect(areaBottom).toBeGreaterThanOrEqual(
      creates[2]!.y + creates[2]!.h! + 16,
    );
    const moved = after.get(below.id)!;
    expect(moved.y - before.get(below.id)!.y).toBe(
      grownArea.h! - before.get(first.id)!.h!,
    );
    expect(after.has(beside.id)).toBe(false);
    const section = after.get(sectionId)!;
    expect(section.h!).toBeGreaterThan(before.get(sectionId)!.h!);
  });

  it('does nothing for an unknown section', () => {
    expect(
      placeSectionNotes(created, 'missing', [{ areaId: 'x', text: 'y' }], {
        createId: ids('n'),
        zIndex: 1,
      }),
    ).toEqual({ creates: [], updates: [] });
  });
});

describe('buildCanvasTimeline', () => {
  const today = new Date(2026, 8, 30);
  const phases = [
    {
      id: 'p1',
      name: 'Discovery',
      colour: null,
      startDate: '2026-09-01',
      dueDate: '2026-09-30',
      isMilestone: false,
      progressPct: 50,
    },
    {
      id: 'p2',
      name: 'Launch',
      colour: '#f00',
      startDate: null,
      dueDate: '2026-10-20',
      isMilestone: true,
      progressPct: 0,
    },
    {
      id: 'p3',
      name: 'Later',
      colour: null,
      startDate: null,
      dueDate: null,
      isMilestone: false,
      progressPct: 0,
    },
  ];
  const tasks = [
    {
      id: 't1',
      title: 'Kick-off',
      phaseId: 'p1',
      dueDate: '2026-09-02',
      done: true,
    },
    {
      id: 't2',
      title: 'Loose end',
      phaseId: null,
      dueDate: '2026-09-10',
      done: false,
    },
  ];

  it('returns null with no dates at all', () => {
    expect(
      buildCanvasTimeline({
        phases: [phases[2]!],
        tasks: [],
        showTasks: true,
        today,
      }),
    ).toBeNull();
  });

  it('lays out bars, milestones, tasks and today', () => {
    const layout = buildCanvasTimeline({
      phases,
      tasks,
      showTasks: true,
      today,
    })!;
    const [discovery, launch, later, loose] = layout.rows;
    expect(discovery!.from!).toBeLessThan(discovery!.to!);
    expect(launch!.milestone).toBe(true);
    expect(launch!.from).toBe(launch!.to);
    expect(later!.from).toBeNull();
    expect(layout.undatedPhases).toEqual(['Later']);
    expect(discovery!.tasks[0]).toMatchObject({ id: 't1', done: true });
    expect(loose).toMatchObject({ id: null, name: 'No phase' });
    expect(loose!.tasks[0]).toMatchObject({ id: 't2', overdue: true });
    expect(layout.today!).toBeGreaterThan(discovery!.from!);
    expect(layout.today!).toBeLessThan(launch!.from!);
    for (const tick of layout.ticks) {
      expect(tick.at).toBeGreaterThanOrEqual(0);
      expect(tick.at).toBeLessThanOrEqual(1);
    }
  });

  it('hides tasks when asked', () => {
    const layout = buildCanvasTimeline({
      phases,
      tasks,
      showTasks: false,
      today,
    })!;
    expect(layout.rows.every((row) => row.tasks.length === 0)).toBe(true);
    expect(layout.rows.some((row) => row.id === null)).toBe(false);
  });
});

describe('searchCanvasEntries', () => {
  const entries = [
    { id: '1', kind: 'sticky', label: 'Budget sign-off', detail: '' },
    {
      id: '2',
      kind: 'note',
      label: 'Kick-off notes',
      detail: 'agree the budget with Zoë',
    },
    { id: '3', kind: 'task', label: 'Budgeting spreadsheet', detail: '' },
  ];

  it('ranks title matches above body matches', () => {
    expect(searchCanvasEntries(entries, 'budget').map((e) => e.id)).toEqual([
      '1',
      '3',
      '2',
    ]);
  });

  it('requires every term and ignores accents', () => {
    expect(searchCanvasEntries(entries, 'budget zoe').map((e) => e.id)).toEqual(
      ['2'],
    );
    expect(searchCanvasEntries(entries, '   ')).toEqual([]);
  });
});

describe('canvas comments', () => {
  const comment = (
    id: string,
    itemId: string,
    createdAt: string,
    resolvedAt: string | null = null,
  ) => ({ id, itemId, authorId: 'u1', createdAt, resolvedAt });

  it('groups by item, oldest first, root carries resolved state', () => {
    const threads = groupCanvasComments([
      comment('b', 'i1', '2026-09-30T10:05:00Z'),
      comment('a', 'i1', '2026-09-30T10:00:00Z', '2026-09-30T11:00:00Z'),
      comment('c', 'i2', '2026-09-30T12:00:00Z'),
    ]);
    expect(threads.map((t) => t.itemId)).toEqual(['i2', 'i1']);
    expect(threads[1]!.comments.map((c) => c.id)).toEqual(['a', 'b']);
    expect(threads[1]!.resolved).toBe(true);
    expect(threads[0]!.resolved).toBe(false);
  });

  it('detects the mention being typed', () => {
    expect(mentionQueryAt('Hi @da', 6)).toEqual({ query: 'da', start: 3 });
    expect(mentionQueryAt('@', 1)).toEqual({ query: '', start: 0 });
    expect(mentionQueryAt('email@x', 7)).toBeNull();
    expect(mentionQueryAt('@dan done', 9)).toBeNull();
  });

  it('keeps only mentions still in the text', () => {
    const picked = [
      { id: 'u1', name: 'Dan Potter' },
      { id: 'u2', name: 'Sam' },
    ];
    expect(activeMentionIds('Thanks @Dan Potter!', picked)).toEqual(['u1']);
    expect(activeMentionIds('cc @Samantha', picked)).toEqual([]);
  });
});

describe('canvas AI parsing', () => {
  it('strips fences and drops unknown area keys', () => {
    const request = {
      mode: 'fill_areas' as const,
      sectionTitle: 'Brief',
      areas: [{ key: 'a1', title: 'Goals', existing: [] }],
    };
    const result = parseCanvasAiResponse(
      request,
      '```json\n{"areas":[{"key":"a1","notes":["Grow leads"]},{"key":"zz","notes":["x"]}]}\n```',
    );
    expect(result).toEqual({
      mode: 'fill_areas',
      areas: [{ key: 'a1', notes: ['Grow leads'] }],
    });
  });

  it('dedupes calendar cells and filters unknown rows/weeks', () => {
    const request = {
      mode: 'fill_calendar' as const,
      sectionTitle: 'Calendar',
      rows: [{ key: 'r1', title: 'Social', existing: [] }],
      weeks: [{ key: 'w1', label: 'w/c 5 Oct' }],
    };
    const result = parseCanvasAiResponse(
      request,
      JSON.stringify({
        cells: [
          { row: 'r1', week: 'w1', text: 'Teaser' },
          { row: 'r1', week: 'w1', text: 'Duplicate' },
          { row: 'r9', week: 'w1', text: 'Unknown' },
        ],
      }),
    );
    expect(result).toEqual({
      mode: 'fill_calendar',
      cells: [{ row: 'r1', week: 'w1', text: 'Teaser' }],
    });
  });

  it('normalises task priority and dates', () => {
    const result = parseCanvasAiResponse(
      { mode: 'tasks', items: [{ kind: 'Sticky', text: 'x' }] },
      JSON.stringify({
        tasks: [
          { title: 'Book venue', priority: 'critical', dueDate: 'next week' },
          { title: 'Send brief', priority: 'high', dueDate: '2026-10-02' },
        ],
      }),
    );
    expect(result).toEqual({
      mode: 'tasks',
      tasks: [
        { title: 'Book venue', priority: 'medium', dueDate: null },
        { title: 'Send brief', priority: 'high', dueDate: '2026-10-02' },
      ],
    });
  });

  it('throws a friendly error on unreadable replies', () => {
    expect(() =>
      parseCanvasAiResponse(
        { mode: 'brainstorm', prompt: 'x', items: [] },
        'nope',
      ),
    ).toThrow(/couldn't be read|expected shape/);
  });

  it('puts today and area keys in the prompt', () => {
    const { user } = buildCanvasAiPrompt(
      {
        mode: 'fill_areas',
        sectionTitle: 'Brief',
        areas: [{ key: 'a1', title: 'Goals', existing: ['Grow'] }],
      },
      'Project: Test',
      '2026-09-30',
    );
    expect(user).toContain('Today: 2026-09-30');
    expect(user).toContain('key="a1"');
    expect(user).toContain('"Grow"');
  });
});

describe('canvas link cards', () => {
  it('accepts a lone web address and rejects prose', () => {
    expect(canvasUrlFromText('  https://example.com/a?b=1 ')).toBe(
      'https://example.com/a?b=1',
    );
    expect(canvasUrlFromText('www.example.com')).toBe(
      'https://www.example.com/',
    );
    expect(canvasUrlFromText('see https://example.com')).toBeNull();
    expect(canvasUrlFromText('javascript:alert(1)')).toBeNull();
    expect(canvasUrlFromText('example')).toBeNull();
    expect(canvasUrlFromText(`https://x.com/${'a'.repeat(2001)}`)).toBeNull();
  });

  it('spots direct image links', () => {
    expect(isCanvasImageUrl('https://cdn.test/photo.JPG?w=200')).toBe(true);
    expect(isCanvasImageUrl('https://example.com/article')).toBe(false);
    expect(isCanvasImageUrl('not a url')).toBe(false);
  });

  it('trims previews and drops unsafe image urls', () => {
    expect(
      linkCardPreview({
        title: '  Big\n  News ',
        description: '',
        faviconUrl: 'data:image/png;base64,xx',
        ogImageUrl: 'https://example.com/og.png',
      }),
    ).toEqual({
      title: 'Big News',
      description: undefined,
      faviconUrl: undefined,
      imageUrl: 'https://example.com/og.png',
    });
    expect(linkCardPreview({ title: 'x'.repeat(600) }).title).toHaveLength(500);
  });
});

describe('canvas clipboard', () => {
  const item = (
    id: string,
    kind: CanvasItem['kind'],
    extra: Partial<CanvasItem> = {},
  ): CanvasItem => ({
    id,
    kind,
    refId: null,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    zIndex: 1,
    data: {},
    updatedAt: '2026-09-30T00:00:00.000Z',
    updatedBy: 'u1',
    ...extra,
  });

  const a = item('a', 'sticky', { zIndex: 2 });
  const b = item('b', 'link', { x: 200, zIndex: 1, data: { linkId: 'l1' } });
  const task = item('t', 'task', { refId: 'task-1' });
  const arrow = item('c', 'connector', { data: { source: 'a', target: 'b' } });
  const loose = item('d', 'connector', { data: { source: 'a', target: 't' } });
  const all = [a, b, task, arrow, loose];

  it('copies freeform items and the arrows between them only', () => {
    expect(copyCanvasItems([a, b, task], all).map((i) => i.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('pastes fresh, offset copies stacked on top with arrows rewired', () => {
    const pasted = pasteCanvasItems([a, b, arrow], {
      dx: 24,
      dy: 24,
      newId: ids('n'),
      zBase: () => 10,
      keepLinkIds: false,
    });
    const map = byId(pasted);
    // b sat below a, so it keeps the lower z-index.
    expect(map.get('n0')).toMatchObject({ x: 224, y: 24, zIndex: 10 });
    expect(map.get('n0')?.data.linkId).toBeUndefined();
    expect(map.get('n1')).toMatchObject({ x: 24, zIndex: 11 });
    expect(map.get('n2')?.data).toMatchObject({ source: 'n1', target: 'n0' });
    expect(pasted.every((i) => i.updatedBy === null)).toBe(true);

    const same = pasteCanvasItems([b], {
      dx: 0,
      dy: 0,
      newId: ids('m'),
      zBase: () => 1,
      keepLinkIds: true,
    });
    expect(same[0]?.data.linkId).toBe('l1');
  });

  it('offsets next to visible originals, otherwise centres in view', () => {
    const view = { x: 0, y: 0, w: 1000, h: 800 };
    expect(
      canvasPasteOffset([a], view, { sameProject: true, nudge: 48 }),
    ).toEqual({ dx: 48, dy: 48 });
    expect(
      canvasPasteOffset([a], view, { sameProject: false, nudge: 48 }),
    ).toEqual({ dx: 450, dy: 350 });
    const far = item('f', 'sticky', { x: 5000, y: 5000 });
    expect(
      canvasPasteOffset([far], view, { sameProject: true, nudge: 24 }),
    ).toEqual({ dx: -4550, dy: -4650 });
  });

  it('rejects clipboard data that is not canvas items', () => {
    const clip = { v: 1, accountId: 'acc', projectId: 'p', items: [a, task] };
    expect(parseCanvasClipboard(JSON.stringify(clip))?.items).toEqual([a]);
    expect(parseCanvasClipboard('hello')).toBeNull();
    expect(
      parseCanvasClipboard(JSON.stringify({ ...clip, items: [task] })),
    ).toBeNull();
    expect(parseCanvasClipboard(JSON.stringify({ ...clip, v: 2 }))).toBeNull();
  });
});

describe('figures', () => {
  it('reads the number out of a typed figure', () => {
    expect(parseMetricNumber('£12,400')).toBe(12400);
    expect(parseMetricNumber('3.2m')).toBe(3_200_000);
    expect(parseMetricNumber('45%')).toBe(45);
    expect(parseMetricNumber('12 months')).toBe(12);
    expect(parseMetricNumber('TBC')).toBeNull();
    expect(parseMetricNumber('')).toBeNull();
  });

  it('works out progress towards a target', () => {
    expect(metricProgress('£8,000', '£10,000')).toBeCloseTo(0.8);
    expect(metricProgress('12k', '10k')).toBeCloseTo(1.2);
    expect(metricProgress('5', '0')).toBeNull();
    expect(metricProgress('', '10')).toBeNull();
  });
});

describe('goals & targets template', () => {
  it('lays figure cards over the goal areas inside one section', () => {
    const created = buildSectionTemplate(
      GOALS_TARGETS_TEMPLATE,
      { x: 100, y: 200 },
      { container: 1, item: 1 },
      ids('g'),
    );
    const size = sectionTemplateSize(GOALS_TARGETS_TEMPLATE);
    const metrics = created.filter((item) => item.kind === 'metric');
    expect(metrics).toHaveLength(GOALS_TARGETS_TEMPLATE.figures.length);
    const root = created[0]!;
    expect(root.data.preset).toBe('targets');
    for (const item of created.slice(1)) {
      expect(item.x).toBeGreaterThanOrEqual(root.x);
      expect(item.y).toBeGreaterThanOrEqual(root.y);
      expect(item.x + (item.w ?? 0)).toBeLessThanOrEqual(root.x + size.w);
      expect(item.y + (item.h ?? 0)).toBeLessThanOrEqual(root.y + size.h);
    }
    const areaTops = created
      .filter((item) => item.kind === 'frame')
      .slice(1)
      .map((item) => item.y);
    const metricBottom = Math.max(...metrics.map((m) => m.y + (m.h ?? 0)));
    expect(Math.min(...areaTops)).toBeGreaterThan(metricBottom);
  });
});

describe('board layout', () => {
  const phases = [
    { id: 'p1', name: 'Plan' },
    { id: 'p2', name: 'Build' },
  ];
  const tasks = [
    { id: 't1', phaseId: 'p1', status: 'todo' },
    { id: 't2', phaseId: 'p1', status: 'done' },
    { id: 't3', phaseId: 'p2', status: 'in_progress' },
    { id: 't4', phaseId: null, status: 'todo' },
  ];
  const input = (mode: 'phase' | 'status') => ({
    mode,
    projectId: 'proj',
    phases,
    tasks,
    notes: [],
    items: [
      buildLinkedCanvasItem(
        'proj',
        { kind: 'phase', refId: 'p1' },
        { x: 900, y: 40 },
      ),
      // Saved far away: the board ignores it.
      buildLinkedCanvasItem(
        'proj',
        { kind: 'task', refId: 't1' },
        { x: 5000, y: 5000 },
      ),
    ],
  });

  it('stacks tasks in board order inside phase columns', () => {
    const layout = layoutCanvasBoard(input('phase'));
    const keys = layout.columns.map((column) => column.key);
    expect(keys).toEqual(['p1', 'p2', '__none__']);
    const first = layout.columns[0]!;
    expect(first.tasks.map((task) => task.taskId)).toEqual(['t1', 't2']);
    const placed = new Map(layout.items.map((item) => [item.id, item]));
    const [a, b] = first.tasks.map((task) => placed.get(task.itemId)!);
    expect(a!.x).toBe(b!.x);
    expect(b!.y).toBeGreaterThan(a!.y);
    expect(a!.x).toBeGreaterThanOrEqual(first.x);
    expect(layout.columns[1]!.x).toBeGreaterThan(first.x);
  });

  it('does not change the saved positions', () => {
    const source = input('phase');
    const before = JSON.stringify(source.items);
    layoutCanvasBoard(source);
    expect(JSON.stringify(source.items)).toBe(before);
  });

  it('groups tasks by status in status view', () => {
    const layout = layoutCanvasBoard(input('status'));
    const byStatus = Object.fromEntries(
      layout.columns.map((column) => [
        column.status,
        column.tasks.map((task) => task.taskId),
      ]),
    );
    expect(byStatus.todo).toEqual(['t1', 't4']);
    expect(byStatus.in_progress).toEqual(['t3']);
    expect(byStatus.done).toEqual(['t2']);
    expect(layout.items.some((item) => item.kind === 'phase')).toBe(false);
  });

  it('finds the column and slot a card was dropped on', () => {
    const layout = layoutCanvasBoard(input('phase'));
    const placed = new Map(layout.items.map((item) => [item.id, item]));
    const [first, second] = layout.columns;
    const firstTask = placed.get(first!.tasks[0]!.itemId)!;
    const dropX = first!.x + first!.w / 2;
    // Below the last card in the first column: goes to the end.
    const end = planBoardDrop(layout.columns, placed, 'other', {
      x: dropX,
      y: first!.y + first!.h - 5,
    });
    expect(end?.column.key).toBe(first!.key);
    expect(end?.index).toBe(2);
    // Above the first card: goes to the top.
    const top = planBoardDrop(layout.columns, placed, 'other', {
      x: dropX,
      y: firstTask.y - 1,
    });
    expect(top?.index).toBe(0);
    // Over the second column.
    const other = planBoardDrop(layout.columns, placed, 'other', {
      x: second!.x + 10,
      y: second!.y + 80,
    });
    expect(other?.column.key).toBe(second!.key);
    // Nowhere near a column.
    expect(
      planBoardDrop(layout.columns, placed, 'other', { x: -9999, y: 0 }),
    ).toBeNull();
  });

  it('reorders ids around the moved one', () => {
    expect(moveInOrder(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(moveInOrder(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(moveInOrder(['a', 'b'], 'x', 1)).toEqual(['a', 'x', 'b']);
    expect(moveInOrder(['a', 'b'], 'a', 99)).toEqual(['b', 'a']);
  });

  it('moves a task between phases with its subtasks', () => {
    const task = (
      id: string,
      phase: string | null,
      parent: string | null = null,
    ) => ({ id, phase_id: phase, parent_task_id: parent, sort_order: 0 });
    const next = reorderBoardTasks(
      {
        p1: [task('a', 'p1'), task('a1', 'p1', 'a'), task('b', 'p1')],
        p2: [task('c', 'p2')],
      },
      'p2',
      'p2',
      ['a', 'c'],
    );
    expect(next.p1!.map((t) => t.id)).toEqual(['b']);
    expect(next.p2!.map((t) => t.id)).toEqual(['a', 'c', 'a1']);
    expect(next.p2!.find((t) => t.id === 'a1')?.phase_id).toBe('p2');
    expect(next.p2!.map((t) => t.sort_order).slice(0, 2)).toEqual([0, 1]);
  });
});

describe('totalizer pace', () => {
  const startDate = new Date(2026, 9, 1); // 1 Oct
  const dueDate = new Date(2026, 11, 18); // 18 Dec
  const now = new Date(2026, 9, 1 + 30);

  it('reads and writes ISO dates', () => {
    expect(toIsoDate(parseIsoDate('2026-12-18')!)).toBe('2026-12-18');
    expect(parseIsoDate('2026-02-31')).toBeNull();
    expect(parseIsoDate('soon')).toBeNull();
  });

  it('compares progress with the straight-line plan', () => {
    const pace = computeMetricPace({
      value: 2,
      start: 1,
      target: 105,
      startDate,
      dueDate,
      now,
    })!;
    expect(pace.status).toBe('behind');
    expect(pace.daysLeft).toBe(48);
    expect(pace.planValue).toBeGreaterThan(2);
    expect(pace.behindBy).toBeGreaterThan(0);
    expect(pace.perWeekActual).toBeCloseTo(1 / (30 / 7));
    expect(pace.perWeekNeeded).toBeCloseTo(103 / (48 / 7));
    expect(pace.projected).toBeGreaterThan(2);
  });

  it('flags ahead, reached and overdue', () => {
    const base = { start: 0, target: 100, startDate, dueDate };
    expect(computeMetricPace({ ...base, value: 90, now })!.status).toBe(
      'ahead',
    );
    expect(computeMetricPace({ ...base, value: 100, now })!.status).toBe(
      'reached',
    );
    expect(
      computeMetricPace({ ...base, value: 10, now: new Date(2027, 0, 5) })!
        .status,
    ).toBe('overdue');
    expect(
      computeMetricPace({ ...base, value: 0, now: new Date(2026, 8, 1) })!
        .status,
    ).toBe('upcoming');
  });

  it('works for targets that go down', () => {
    const pace = computeMetricPace({
      value: 90,
      start: 100,
      target: 50,
      startDate,
      dueDate,
      now,
    })!;
    expect(pace.progress).toBeCloseTo(0.2);
    expect(pace.status).toBe('behind');
    expect(pace.behindBy).toBeGreaterThan(0);
  });

  it('formats numbers like the typed figure', () => {
    expect(formatMetricNumber(12_400, '£10,000')).toBe('£12.4k');
    expect(formatMetricNumber(42.5, '60%')).toBe('42.5%');
    expect(formatMetricNumber(9.1)).toBe('9.1');
    expect(formatMetricNumber(1_250_000, '$1m')).toBe('$1.3m');
  });

  it('works out weekly change from logged readings', () => {
    const history = [
      { date: '2026-10-10', value: 3 },
      { date: '2026-10-20', value: 5 },
      { date: '2026-10-28', value: 9 },
    ];
    expect(
      metricWeeklyChange({
        history,
        value: 9,
        start: 1,
        now: new Date(2026, 9, 30),
      }),
    ).toEqual({ thisWeek: 4, lastWeek: 2 });
    expect(
      metricWeeklyChange({ history: [], value: 1, start: 0, now }),
    ).toBeNull();
  });

  it('logs one reading per day', () => {
    const first = logMetricPoint(undefined, 3, new Date(2026, 9, 5));
    const again = logMetricPoint(first, 4, new Date(2026, 9, 5));
    expect(again).toEqual([{ date: '2026-10-05', value: 4 }]);
  });

  it('counts live phases and tasks', () => {
    const project = {
      phases: [{ status: 'complete' }, { status: 'in_progress' }],
      tasks: [
        { status: 'done', parent_task_id: null },
        { status: 'todo', parent_task_id: null },
        { status: 'done', parent_task_id: 'x' },
        { status: 'cancelled', parent_task_id: null },
      ],
    };
    expect(projectMetricCount('phases', project)).toEqual({
      value: 1,
      total: 2,
    });
    expect(projectMetricCount('tasks', project)).toEqual({
      value: 1,
      total: 2,
    });
  });

  it('builds a view with milestones sorted by date', () => {
    const view = buildTotalizer(
      {
        value: '2',
        goal: '105',
        start: '1',
        startDate: '2026-10-01',
        dueDate: '2026-12-18',
        milestones: [{ label: 'Beta', goal: '20', dueDate: '2026-11-15' }],
      },
      { phases: [], tasks: [] },
      now,
    )!;
    expect(view.bars.map((bar) => bar.label)).toEqual(['Beta', 'Final target']);
    expect(view.status).toBe('behind');
    expect(view.final?.goal).toBe(105);
    expect(
      buildTotalizer({ value: 'TBC' }, { phases: [], tasks: [] }, now),
    ).toBeNull();
  });
});

describe('google doc embeds', () => {
  const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefg';

  it('recognises docs, sheets and slides', () => {
    const doc = parseGoogleDoc(
      `https://docs.google.com/document/d/${id}/edit?usp=sharing`,
    )!;
    expect(doc.kind).toBe('doc');
    expect(doc.previewUrl).toBe(
      `https://docs.google.com/document/d/${id}/preview`,
    );
    expect(doc.editUrl).toBe(
      `https://docs.google.com/document/d/${id}/edit?rm=minimal`,
    );

    const sheet = parseGoogleDoc(
      `https://docs.google.com/spreadsheets/u/0/d/${id}/edit#gid=42`,
    )!;
    expect(sheet.kind).toBe('sheet');
    expect(sheet.editUrl).toBe(
      `https://docs.google.com/spreadsheets/d/${id}/edit?rm=minimal#gid=42`,
    );
    expect(sheet.previewUrl).toBe(
      `https://docs.google.com/spreadsheets/d/${id}/preview?gid=42`,
    );

    expect(
      parseGoogleDoc(`https://docs.google.com/presentation/d/${id}/edit`)!.kind,
    ).toBe('slides');
  });

  it('recognises forms', () => {
    const form = parseGoogleDoc(
      `https://docs.google.com/forms/d/e/${id}/viewform`,
    )!;
    expect(form.kind).toBe('form');
    expect(form.previewUrl).toBe(
      `https://docs.google.com/forms/d/e/${id}/viewform?embedded=true`,
    );
    expect(
      parseGoogleDoc(`https://docs.google.com/forms/d/${id}/edit`)!.editUrl,
    ).toBe(`https://docs.google.com/forms/d/${id}/edit`);
  });

  it('ignores everything else', () => {
    expect(parseGoogleDoc('https://example.com/document/d/' + id)).toBeNull();
    expect(
      parseGoogleDoc(`http://docs.google.com/document/d/${id}`),
    ).toBeNull();
    expect(
      parseGoogleDoc(`https://docs.google.com.evil.io/document/d/${id}`),
    ).toBeNull();
    expect(parseGoogleDoc('https://docs.google.com/document/u/0/')).toBeNull();
    expect(parseGoogleDoc('not a url')).toBeNull();
    expect(parseGoogleDoc(undefined)).toBeNull();
  });
});

describe('link embeds', () => {
  it('recognises video and design links', () => {
    expect(
      resolveEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s'),
    ).toMatchObject({
      provider: 'youtube',
      previewUrl:
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=90',
      aspect: 16 / 9,
    });
    expect(resolveEmbed('https://youtu.be/dQw4w9WgXcQ')!.previewUrl).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
    );
    expect(
      resolveEmbed('https://www.youtube.com/shorts/dQw4w9WgXcQ')!.provider,
    ).toBe('youtube');
    expect(resolveEmbed('https://vimeo.com/76979871')!.previewUrl).toBe(
      'https://player.vimeo.com/video/76979871',
    );
    expect(
      resolveEmbed(
        'https://www.loom.com/share/0123456789abcdef0123456789abcdef',
      )!.previewUrl,
    ).toBe('https://www.loom.com/embed/0123456789abcdef0123456789abcdef');
    expect(
      resolveEmbed('https://www.figma.com/design/abc123/Name?node-id=1')!
        .provider,
    ).toBe('figma');
  });

  it('keeps Google files editable and everything else unembeddable', () => {
    const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefg';
    expect(
      resolveEmbed(`https://docs.google.com/spreadsheets/d/${id}/edit`)!
        .editUrl,
    ).toContain('rm=minimal');
    expect(resolveEmbed('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(
      resolveEmbed('https://youtube.com.evil.io/watch?v=dQw4w9WgXcQ'),
    ).toBeNull();
    expect(resolveEmbed('http://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(resolveEmbed('https://www.youtube.com/watch?v=short')).toBeNull();
  });

  it('sizes each display and falls back when a site cannot embed', () => {
    const video = resolveEmbed('https://youtu.be/dQw4w9WgXcQ');
    expect(linkDisplaySize('embed', video)).toEqual({ w: 560, h: 351 });
    expect(linkDisplaySize('embed', null)).toEqual({ w: 560, h: 420 });
    expect(linkDisplaySize('link', video).h).toBeLessThan(60);
    expect(effectiveLinkDisplay('embed', null)).toBe('card');
    expect(effectiveLinkDisplay(undefined, video)).toBe('card');
    expect(effectiveLinkDisplay('link', video)).toBe('link');
  });
});
