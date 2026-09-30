import { describe, expect, it } from 'vitest';

import { buildCanvasAiPrompt, parseCanvasAiResponse } from './canvas-ai';
import {
  activeMentionIds,
  groupCanvasComments,
  mentionQueryAt,
} from './canvas-comments';
import { outlineCanvasSection, placeSectionNotes } from './canvas-fill';
import {
  canvasUrlFromText,
  isCanvasImageUrl,
  linkCardPreview,
} from './canvas-links';
import { searchCanvasEntries } from './canvas-search';
import {
  CONTENT_CALENDAR_TEMPLATE,
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
