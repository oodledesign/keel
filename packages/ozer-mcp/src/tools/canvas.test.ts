import type { SupabaseClient } from '@supabase/supabase-js';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';

import {
  CANVAS_COLORS,
  CANVAS_ITEM_KINDS,
  CANVAS_DEFAULT_SIZES as WEB_DEFAULT_SIZES,
  LINKED_CANVAS_KINDS as WEB_LINKED_KINDS,
  CANVAS_SHAPE_TYPES as WEB_SHAPE_TYPES,
} from '../../../../apps/web/lib/projects/canvas/canvas-types';
import { createOzerMcpServer } from '../server';
import {
  addCanvasItemsSchema,
  buildCanvasAdditions,
  buildCanvasUpdate,
  planContainerCarries,
  updateCanvasItemsSchema,
} from './canvas';
import {
  CANVAS_COLOR_KEYS,
  CANVAS_DEFAULT_SIZES,
  CANVAS_SHAPE_TYPES,
  type CanvasRow,
  LINKED_CANVAS_KINDS,
  MCP_CANVAS_CREATE_KINDS,
  flowPlacements,
  normalizeStroke,
  pickConnectorHandles,
} from './canvas-shared';

const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '33333333-3333-4333-8333-333333333333';

function parseAdd(items: unknown[]) {
  return addCanvasItemsSchema.parse({ project_id: PROJECT_ID, items }).items;
}

function row(
  partial: Partial<CanvasRow> & { id: string; kind: string },
): CanvasRow {
  return {
    ref_id: null,
    x: 0,
    y: 0,
    w: null,
    h: null,
    z_index: 1,
    data: {},
    ...partial,
  };
}

describe('mirrors the web canvas definitions', () => {
  it('keeps colours, shapes and default sizes in sync', () => {
    expect([...CANVAS_COLOR_KEYS].sort()).toEqual(
      Object.keys(CANVAS_COLORS).sort(),
    );
    expect([...CANVAS_SHAPE_TYPES]).toEqual(WEB_SHAPE_TYPES);
    expect([...LINKED_CANVAS_KINDS]).toEqual([...WEB_LINKED_KINDS]);
    expect(CANVAS_DEFAULT_SIZES).toMatchObject(WEB_DEFAULT_SIZES);
  });

  it('only creates kinds the web canvas knows', () => {
    for (const kind of MCP_CANVAS_CREATE_KINDS) {
      expect(CANVAS_ITEM_KINDS).toContain(kind);
    }
  });
});

describe('buildCanvasAdditions', () => {
  it('auto-places items in a row below existing content', () => {
    const drafts = buildCanvasAdditions(
      parseAdd([
        { kind: 'sticky', text: 'One' },
        { kind: 'sticky', text: 'Two' },
      ]),
      [row({ id: 'a', kind: 'sticky', x: 100, y: 50, w: 200, h: 200 })],
    );

    expect(drafts[0]!.row).toMatchObject({ x: 100, y: 298, w: 200, h: 200 });
    expect(drafts[1]!.row).toMatchObject({ x: 324, y: 298 });
  });

  it('starts at the origin on an empty canvas and wraps long rows', () => {
    expect(
      flowPlacements(
        Array.from({ length: 9 }, () => ({ w: 200, h: 100 })),
        null,
      )[7],
    ).toEqual({ x: 0, y: 124 });
  });

  it('honours explicit positions and sizes', () => {
    const [draft] = buildCanvasAdditions(
      parseAdd([
        {
          kind: 'shape',
          x: 10,
          y: 20,
          w: 300,
          h: 90,
          shape: 'ellipse',
          color: 'green',
          text: 'Go',
        },
      ]),
      [],
    );

    expect(draft!.row).toMatchObject({
      kind: 'shape',
      x: 10,
      y: 20,
      w: 300,
      h: 90,
      data: { shape: 'ellipse', color: 'green', text: 'Go' },
    });
  });

  it('grows long sticky text and stores font options in web field names', () => {
    const [draft] = buildCanvasAdditions(
      parseAdd([
        {
          kind: 'sticky',
          text: 'word '.repeat(120),
          font_size: 16,
          bold: true,
        },
      ]),
      [],
    );

    expect(draft!.row.h).toBeGreaterThan(200);
    expect(draft!.row.data).toMatchObject({
      fontSize: 16,
      bold: true,
      color: 'yellow',
    });
  });

  it('keeps frames behind other items', () => {
    const drafts = buildCanvasAdditions(
      parseAdd([
        { kind: 'sticky', text: 'a' },
        { kind: 'frame', title: 'Section' },
      ]),
      [
        row({ id: 'p', kind: 'phase', z_index: 3 }),
        row({ id: 's', kind: 'sticky', z_index: 7 }),
      ],
    );

    expect(drafts[0]!.row.z_index).toBe(8);
    expect(drafts[1]!.row.z_index).toBe(4);
    expect(drafts[1]!.row.data).toMatchObject({
      title: 'Section',
      color: 'slate',
    });
  });

  it('turns draw points into a normalised, relative stroke', () => {
    const [draft] = buildCanvasAdditions(
      parseAdd([
        {
          kind: 'draw',
          points: [
            [100, 100],
            [150, 100],
            [200, 100],
            [200, 160],
          ],
          color: 'coral',
          stroke_width: 4,
        },
      ]),
      [],
    );

    // Collinear middle point is simplified away; points are box-relative.
    expect(draft!.row.data.points).toEqual([
      [4, 4],
      [104, 4],
      [104, 64],
    ]);
    expect(draft!.row).toMatchObject({ x: 96, y: 96, w: 108, h: 68 });
    expect(draft!.row.data).toMatchObject({ color: 'coral', strokeWidth: 4 });
  });

  it('connects keyed items in the same call and picks facing handles', () => {
    const drafts = buildCanvasAdditions(
      parseAdd([
        { kind: 'sticky', key: 'a', text: 'Start', x: 0, y: 0 },
        { kind: 'sticky', key: 'b', text: 'End', x: 500, y: 0 },
        { kind: 'connector', source: 'a', target: 'b', label: 'then' },
      ]),
      [],
    );

    const connector = drafts[2]!.row;
    expect(connector).toMatchObject({ kind: 'connector', w: null, h: null });
    expect(connector.data).toMatchObject({
      source: drafts[0]!.row.id,
      target: drafts[1]!.row.id,
      sourceHandle: 'right',
      targetHandle: 'left',
      label: 'then',
    });
  });

  it('connects to an existing item by id and rejects duplicates', () => {
    const existing = [
      row({ id: 'e1', kind: 'sticky', x: 0, y: 0, w: 100, h: 100 }),
      row({
        id: 'c1',
        kind: 'connector',
        data: { source: 'e1', target: 'e2' },
      }),
      row({ id: 'e2', kind: 'sticky', x: 0, y: 400, w: 100, h: 100 }),
    ];

    const [ok] = buildCanvasAdditions(
      parseAdd([{ kind: 'connector', source: 'e2', target: 'e1' }]),
      existing,
    );
    expect(ok!.row.data).toMatchObject({
      sourceHandle: 'top',
      targetHandle: 'bottom',
    });

    expect(() =>
      buildCanvasAdditions(
        parseAdd([{ kind: 'connector', source: 'e1', target: 'e2' }]),
        existing,
      ),
    ).toThrow('already connected');
  });

  it('rejects bad input with the item index', () => {
    const build = (items: unknown[]) =>
      buildCanvasAdditions(parseAdd(items), []);

    expect(() => build([{ kind: 'sticky' }])).toThrow(
      'items[0]: sticky items need text',
    );
    expect(() => build([{ kind: 'frame', text: 'x' }])).toThrow(
      'frame items do not support text',
    );
    expect(() =>
      build([
        { kind: 'link', url: 'https://ok.dev' },
        { kind: 'sticky', text: 'a', url: 'https://x.dev' },
      ]),
    ).toThrow('items[1]');
    expect(() => build([{ kind: 'sticky', text: 'a', x: 4 }])).toThrow(
      'both x and y',
    );
    expect(() =>
      build([{ kind: 'connector', source: 'nope', target: 'nah' }]),
    ).toThrow('neither an item');
    expect(() =>
      build([
        { kind: 'sticky', key: 'k', text: 'a' },
        { kind: 'sticky', key: 'k', text: 'b' },
      ]),
    ).toThrow('duplicate key');
    expect(() =>
      build([
        {
          kind: 'draw',
          points: [
            [0, 0],
            [5, 5],
          ],
          x: 1,
          y: 1,
        },
      ]),
    ).toThrow('positioned by their points');
  });

  it('validates input shapes at the schema', () => {
    expect(() =>
      parseAdd([{ kind: 'sticky', text: 'a', color: 'neon' }]),
    ).toThrow();
    expect(() =>
      parseAdd([{ kind: 'link', url: 'javascript:alert(1)' }]),
    ).toThrow();
    expect(() =>
      parseAdd([{ kind: 'image', url: 'https://x.dev/a.png' }]),
    ).toThrow();
    expect(() => parseAdd([{ kind: 'draw', points: [[0, 0]] }])).toThrow();
    expect(() =>
      buildCanvasAdditions(parseAdd([{ kind: 'draw' }]), []),
    ).toThrow('draw items need points');
    expect(() =>
      buildCanvasAdditions(
        parseAdd([
          { kind: 'sticky', key: 'a', text: 'a' },
          { kind: 'sticky', key: 'b', text: 'b' },
          { kind: 'connector', key: 'a', source: 'a', target: 'b' },
        ]),
        [],
      ),
    ).toThrow('duplicate key');
  });
});

describe('buildCanvasUpdate', () => {
  const sticky = row({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    kind: 'sticky',
    x: 10,
    y: 10,
    data: { text: 'Old', color: 'yellow' },
  });

  function patch(input: unknown) {
    return updateCanvasItemsSchema.parse({ items: [input] }).items[0]!;
  }

  it('moves and edits content, merging into existing data', () => {
    expect(
      buildCanvasUpdate(
        sticky,
        patch({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          x: 40,
          text: 'New',
          font_size: 20,
        }),
        0,
      ),
    ).toEqual({
      x: 40,
      data: { text: 'New', color: 'yellow', fontSize: 20 },
    });
  });

  it('only moves linked cards', () => {
    const task = row({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      kind: 'task',
      ref_id: 'r1',
    });
    expect(
      buildCanvasUpdate(
        task,
        patch({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', x: 1, y: 2 }),
        0,
      ),
    ).toEqual({ x: 1, y: 2 });
    expect(() =>
      buildCanvasUpdate(
        task,
        patch({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', text: 'nope' }),
        0,
      ),
    ).toThrow('Only position, size and z_index');
  });

  it('re-normalises a replaced stroke and blocks resizing drawings', () => {
    const draw = row({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      kind: 'draw',
      data: { points: [[0, 0]], strokeWidth: 3, color: 'slate' },
    });
    const update = buildCanvasUpdate(
      draw,
      patch({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        points: [
          [10, 10],
          [60, 10],
        ],
        color: 'blue',
      }),
      0,
    );

    expect(update).toMatchObject({ x: 6, y: 6, w: 58, h: 8 });
    expect(update.data).toMatchObject({ color: 'blue', strokeWidth: 3 });
    expect(() =>
      buildCanvasUpdate(
        draw,
        patch({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', w: 50 }),
        0,
      ),
    ).toThrow('cannot be resized');
  });

  it('keeps connectors positionless and rejects empty patches', () => {
    const connector = row({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      kind: 'connector',
      data: { source: 'a', target: 'b' },
    });
    expect(
      buildCanvasUpdate(
        connector,
        patch({
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          label: 'x',
          color: 'coral',
        }),
        0,
      ),
    ).toEqual({
      data: { source: 'a', target: 'b', label: 'x', color: 'coral' },
    });
    expect(() =>
      buildCanvasUpdate(
        connector,
        patch({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', x: 5 }),
        0,
      ),
    ).toThrow('no position');
    expect(() =>
      buildCanvasUpdate(
        sticky,
        patch({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
        0,
      ),
    ).toThrow('at least one field');
  });
});

describe('geometry helpers', () => {
  it('points arrows along the dominant axis', () => {
    const box = (x: number, y: number) => ({ x, y, w: 100, h: 100 });
    expect(pickConnectorHandles(box(0, 0), box(0, 300))).toEqual({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    });
    expect(pickConnectorHandles(box(300, 0), box(0, 0))).toEqual({
      sourceHandle: 'left',
      targetHandle: 'right',
    });
  });

  it('thins dense strokes', () => {
    const points: Array<[number, number]> = Array.from(
      { length: 500 },
      (_, i) => [i, 0],
    );
    expect(normalizeStroke(points, 3).points).toHaveLength(2);
  });
});

/** Minimal chainable Supabase stub for the canvas tables. */
function createCanvasSupabase(options: {
  existing?: Array<Record<string, unknown>>;
  canEdit?: boolean;
  projectType?: string;
}) {
  const store = [...(options.existing ?? [])];
  const inserted: Array<Record<string, unknown>> = [];
  const updated: Array<{ id: string; patch: Record<string, unknown> }> = [];

  const client = {
    rpc(name: string) {
      return Promise.resolve({
        data:
          name === 'can_edit_project_canvas'
            ? (options.canEdit ?? true)
            : name === 'can_guest_edit_project_canvas'
              ? false
              : true,
        error: null,
      });
    },
    from(table: string) {
      let rows: Array<Record<string, unknown>> =
        table === 'projects'
          ? [
              {
                id: PROJECT_ID,
                name: 'Shopfront',
                account_id: ACCOUNT_ID,
                project_type: options.projectType ?? 'delivery',
              },
            ]
          : table === 'project_canvas_items'
            ? [...store]
            : [];
      let pending: Array<Record<string, unknown>> | null = null;
      let patch: Record<string, unknown> | null = null;

      const builder = {
        select() {
          return builder;
        },
        insert(values: Array<Record<string, unknown>>) {
          pending = values.map((value) => ({
            created_at: 'now',
            ref_id: null,
            ...value,
          }));
          inserted.push(...pending);
          return builder;
        },
        update(values: Record<string, unknown>) {
          patch = values;
          return builder;
        },
        eq(column: string, value: unknown) {
          rows = rows.filter((r) => r[column] === value);
          return builder;
        },
        in(column: string, values: unknown[]) {
          rows = rows.filter((r) => values.includes(r[column]));
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle() {
          if (patch && rows[0]) {
            const source = store.find((r) => r.id === rows[0]!.id)!;
            Object.assign(source, patch);
            updated.push({ id: String(source.id), patch });
            rows = [source];
          }
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          return Promise.resolve({ data: pending ?? rows, error: null }).then(
            resolve,
          );
        },
      };

      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, inserted, updated };
}

async function connect(supabase: SupabaseClient) {
  const server = createOzerMcpServer({
    userId: USER_ID,
    clientId: 'test',
    accessToken: 'token',
    supabase,
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

function toolResult(result: Awaited<ReturnType<Client['callTool']>>) {
  const [content] = result.content as Array<{ type: string; text: string }>;
  return { isError: result.isError === true, text: content!.text };
}

describe('canvas tools over MCP', () => {
  it('advertises the canvas tools with usable input schemas', async () => {
    const client = await connect(createCanvasSupabase({}).client);
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    for (const name of [
      'get_project_canvas',
      'add_canvas_items',
      'update_canvas_items',
    ]) {
      expect(byName.has(name), name).toBe(true);
    }

    const add = byName.get('add_canvas_items')!.inputSchema as unknown as {
      properties: { items: { items: { properties: Record<string, unknown> } } };
    };
    expect(Object.keys(add.properties.items.items.properties)).toEqual(
      expect.arrayContaining([
        'kind',
        'key',
        'x',
        'y',
        'points',
        'source',
        'target',
        'color',
      ]),
    );
  });

  it('adds a sticky and a connected shape in one call', async () => {
    const { client: supabase, inserted } = createCanvasSupabase({});
    const client = await connect(supabase);

    const result = toolResult(
      await client.callTool({
        name: 'add_canvas_items',
        arguments: {
          project_id: PROJECT_ID,
          items: [
            { kind: 'sticky', key: 'idea', text: 'Ship it' },
            { kind: 'shape', key: 'box', shape: 'diamond', text: 'Decide' },
            { kind: 'connector', source: 'idea', target: 'box' },
          ],
        },
      }),
    );

    expect(result.isError).toBe(false);
    const body = JSON.parse(result.text);
    expect(body.created_count).toBe(3);
    expect(Object.keys(body.keys)).toEqual(['idea', 'box']);
    expect(inserted).toHaveLength(3);
    expect(inserted[0]).toMatchObject({
      account_id: ACCOUNT_ID,
      project_id: PROJECT_ID,
      updated_by: USER_ID,
      ref_id: null,
    });
    expect(inserted[2]!.data).toMatchObject({
      source: body.keys.idea,
      target: body.keys.box,
    });
  });

  it('refuses to edit without canvas permission or on non-delivery projects', async () => {
    const noEdit = await connect(
      createCanvasSupabase({ canEdit: false }).client,
    );
    const denied = toolResult(
      await noEdit.callTool({
        name: 'add_canvas_items',
        arguments: {
          project_id: PROJECT_ID,
          items: [{ kind: 'sticky', text: 'x' }],
        },
      }),
    );
    expect(denied.isError).toBe(true);
    expect(denied.text).toContain('permission');

    const wrongType = await connect(
      createCanvasSupabase({ projectType: 'retainer' }).client,
    );
    const rejected = toolResult(
      await wrongType.callTool({
        name: 'get_project_canvas',
        arguments: { project_id: PROJECT_ID },
      }),
    );
    expect(rejected.isError).toBe(true);
    expect(rejected.text).toContain('delivery projects');
  });

  it('reads the canvas with counts, bounds and linked labels', async () => {
    const { client: supabase } = createCanvasSupabase({
      existing: [
        {
          id: 'i1',
          kind: 'sticky',
          project_id: PROJECT_ID,
          ref_id: null,
          x: 0,
          y: 0,
          w: 200,
          h: 200,
          z_index: 1,
          data: { text: 'Hello', color: 'pink' },
        },
        {
          id: 'i2',
          kind: 'connector',
          project_id: PROJECT_ID,
          ref_id: null,
          x: 0,
          y: 0,
          w: null,
          h: null,
          z_index: 0,
          data: { source: 'i1', target: 'i3' },
        },
      ],
    });
    const client = await connect(supabase);

    const body = JSON.parse(
      toolResult(
        await client.callTool({
          name: 'get_project_canvas',
          arguments: { project_id: PROJECT_ID },
        }),
      ).text,
    );

    expect(body.counts).toEqual({ sticky: 1, connector: 1 });
    expect(body.bounds).toEqual({ x: 0, y: 0, w: 200, h: 200 });
    expect(body.items[0]).toMatchObject({
      id: 'i1',
      text: 'Hello',
      color: 'pink',
    });
    expect(body.items[1]).toMatchObject({
      id: 'i2',
      source: 'i1',
      target: 'i3',
    });
  });
  it('updates items through the protocol and stamps the editor', async () => {
    const STICKY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const { client: supabase, updated } = createCanvasSupabase({
      existing: [
        {
          id: STICKY,
          kind: 'sticky',
          project_id: PROJECT_ID,
          account_id: ACCOUNT_ID,
          ref_id: null,
          x: 0,
          y: 0,
          w: 200,
          h: 200,
          z_index: 1,
          data: { text: 'Old', color: 'yellow' },
        },
      ],
    });
    const client = await connect(supabase);

    const result = toolResult(
      await client.callTool({
        name: 'update_canvas_items',
        arguments: {
          items: [{ id: STICKY, x: 300, text: 'New', color: 'green' }],
        },
      }),
    );

    expect(result.isError).toBe(false);
    expect(updated).toEqual([
      {
        id: STICKY,
        patch: {
          x: 300,
          data: { text: 'New', color: 'green' },
          updated_by: USER_ID,
        },
      },
    ]);
    expect(JSON.parse(result.text).items[0]).toMatchObject({
      id: STICKY,
      x: 300,
      text: 'New',
      color: 'green',
    });
  });

  it('validates every patch before writing any', async () => {
    const STICKY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const MISSING = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const { client: supabase, updated } = createCanvasSupabase({
      existing: [
        {
          id: STICKY,
          kind: 'sticky',
          project_id: PROJECT_ID,
          account_id: ACCOUNT_ID,
          ref_id: null,
          x: 0,
          y: 0,
          w: 200,
          h: 200,
          z_index: 1,
          data: { text: 'Old' },
        },
      ],
    });
    const client = await connect(supabase);

    const missing = toolResult(
      await client.callTool({
        name: 'update_canvas_items',
        arguments: {
          items: [
            { id: STICKY, x: 5 },
            { id: MISSING, x: 5 },
          ],
        },
      }),
    );
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('not found or not accessible');

    const unsupported = toolResult(
      await client.callTool({
        name: 'update_canvas_items',
        arguments: {
          items: [
            { id: STICKY, x: 5 },
            { id: STICKY, y: 5 },
          ],
        },
      }),
    );
    expect(unsupported.isError).toBe(true);
    expect(unsupported.text).toContain('only once per call');

    expect(updated).toEqual([]);
  });
});

describe('planContainerCarries', () => {
  const frame = row({ id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300 });
  const inside = row({ id: 'a', kind: 'sticky', x: 50, y: 50 });
  const outside = row({ id: 'b', kind: 'sticky', x: 900, y: 900 });
  const edge = row({ id: 'c', kind: 'sticky', x: 350, y: 250 }); // centre 450,350: out
  const inner = row({ id: 'g', kind: 'frame', x: 20, y: 20, w: 100, h: 100 });
  const big = row({ id: 'h', kind: 'frame', x: 0, y: 0, w: 800, h: 600 });

  it('carries items whose centre is inside, by the same delta', () => {
    const carried = planContainerCarries(
      [frame, inside, outside, edge],
      [{ id: 'f', dx: 100, dy: -20 }],
      new Set(['f']),
    );
    expect(carried.map((c) => [c.row.id, c.x, c.y])).toEqual([['a', 150, 30]]);
  });

  it('skips items patched explicitly and larger nested containers', () => {
    const carried = planContainerCarries(
      [frame, inside, inner, big],
      [{ id: 'f', dx: 10, dy: 10 }],
      new Set(['f', 'a']),
    );
    expect(carried.map((c) => c.row.id)).toEqual(['g']);
  });

  it('lets the smallest moving container win', () => {
    const carried = planContainerCarries(
      [big, frame, inside],
      [
        { id: 'h', dx: 1000, dy: 0 },
        { id: 'f', dx: 5, dy: 0 },
      ],
      new Set(['h', 'f']),
    );
    expect(carried).toHaveLength(1);
    expect(carried[0]!.x).toBe(55);
  });
});
