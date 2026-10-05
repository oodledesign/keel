import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import {
  CANVAS_COLOR_KEYS,
  CANVAS_DEFAULT_SIZES,
  CANVAS_ITEM_COLUMNS,
  CANVAS_SHAPE_TYPES,
  type CanvasBox,
  type CanvasPoint,
  type CanvasRow,
  type CanvasRowData,
  LINKED_CANVAS_KINDS,
  MCP_CANVAS_CREATE_KINDS,
  boundsOf,
  canvasContentBounds,
  estimateTextHeight,
  flowPlacements,
  isConnectorKind,
  isContainerKind,
  nextZIndexes,
  normalizeStroke,
  pickConnectorHandles,
  rowBox,
  rowData,
} from './canvas-shared';
import { assertSupabaseOk, toolJson } from './shared';
import type { OzerMcpToolRegistrar } from './types';

const MAX_ITEMS_PER_CALL = 100;
const MAX_CANVAS_ITEMS_RETURNED = 500;

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const dimension = z.number().finite().positive().max(20_000);
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => /^https?:\/\//i.test(value), 'Use an http(s) link');

/** Content fields shared by create and update. All optional; validity depends on kind. */
const contentFields = {
  text: z
    .string()
    .max(10_000)
    .optional()
    .describe('Body text for sticky, text and shape items.'),
  title: z
    .string()
    .max(500)
    .optional()
    .describe('Frame heading, or link card title.'),
  description: z
    .string()
    .max(1000)
    .optional()
    .describe('Link card description.'),
  label: z.string().max(500).optional().describe('Connector label.'),
  url: httpUrl.optional().describe('Link card URL (http/https).'),
  color: z
    .enum(CANVAS_COLOR_KEYS)
    .optional()
    .describe(
      'Palette colour for stickies, shapes, frames, pen strokes and arrows.',
    ),
  shape: z.enum(CANVAS_SHAPE_TYPES).optional().describe('Shape items only.'),
  font_size: z
    .number()
    .int()
    .min(8)
    .max(200)
    .optional()
    .describe('Sticky/text/shape/frame font size in px (default per kind).'),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  points: z
    .array(z.tuple([z.number().finite(), z.number().finite()]))
    .min(2)
    .max(4000)
    .optional()
    .describe(
      'Draw items: freehand stroke as [x, y] points in absolute canvas coordinates (same space as item x/y). Use many points for curves; the server smooths and simplifies them.',
    ),
  stroke_width: z
    .number()
    .min(1)
    .max(40)
    .optional()
    .describe('Draw items: pen width (default 3).'),
};

type ContentFields = {
  [K in keyof typeof contentFields]?: z.infer<(typeof contentFields)[K]>;
};

const addItemSchema = z.object({
  kind: z
    .enum(MCP_CANVAS_CREATE_KINDS)
    .describe(
      'sticky (note card), text (free text), shape (rectangle/ellipse/diamond), frame (titled section that holds items inside it), link (URL card), draw (freehand stroke from points), connector (arrow between two items).',
    ),
  key: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional()
    .describe(
      'Local name for this item so connectors in the same call can reference it via source/target.',
    ),
  x: coordinate
    .optional()
    .describe(
      'Left edge in canvas coordinates. Provide both x and y, or omit both to auto-place below existing content. Ignored for draw (points set position) and connector.',
    ),
  y: coordinate.optional().describe('Top edge; see x.'),
  w: dimension.optional().describe('Width in px (defaults per kind).'),
  h: dimension
    .optional()
    .describe('Height in px (defaults per kind; grown for long text).'),
  source: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional()
    .describe(
      'Connector start: an existing item id (from get_project_canvas) or a key from this call.',
    ),
  target: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional()
    .describe('Connector end: an item id or a key from this call.'),
  ...contentFields,
});

export const addCanvasItemsSchema = z.object({
  project_id: z
    .string()
    .uuid()
    .describe('Delivery project whose canvas to add to.'),
  items: z
    .array(addItemSchema)
    .min(1)
    .max(MAX_ITEMS_PER_CALL)
    .describe(
      'Items to create, in order. Connectors may reference items created earlier or later in the same call by key.',
    ),
});

const updateItemSchema = z.object({
  id: z.string().uuid().describe('Canvas item id from get_project_canvas.'),
  x: coordinate.optional(),
  y: coordinate.optional(),
  w: dimension.optional(),
  h: dimension.optional(),
  z_index: z
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .optional()
    .describe('Stacking order; higher sits on top.'),
  ...contentFields,
});

export const updateCanvasItemsSchema = z.object({
  move_contents: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'When a frame or phase is moved (x/y), also move the items inside it (centre within its box), like dragging it in the editor. Default true. Items you also patch in the same call keep their own patch. Set false to move only the container.',
    ),
  items: z
    .array(updateItemSchema)
    .min(1)
    .max(MAX_ITEMS_PER_CALL)
    .describe(
      'Patches to apply. Only provided fields change. All items must be on delivery projects you can edit.',
    ),
});

export const getProjectCanvasSchema = z.object({
  project_id: z.string().uuid(),
  kinds: z
    .array(z.string().trim().min(1).max(32))
    .optional()
    .describe('Only return these kinds, e.g. ["sticky","frame"].'),
});

/** Content fields each kind accepts. Anything else is rejected, not ignored. */
const ALLOWED_CONTENT_FIELDS: Record<string, readonly string[]> = {
  sticky: ['text', 'color', 'font_size', 'bold', 'italic'],
  text: ['text', 'color', 'font_size', 'bold', 'italic'],
  shape: ['text', 'shape', 'color', 'font_size', 'bold', 'italic'],
  frame: ['title', 'color', 'font_size', 'bold', 'italic'],
  link: ['url', 'title', 'description'],
  draw: ['points', 'color', 'stroke_width'],
  connector: ['color', 'label'],
};

const CONTENT_FIELD_NAMES = Object.keys(contentFields);

function assertFieldsAllowed(
  kind: string,
  input: Record<string, unknown>,
  where: string,
) {
  const allowed = ALLOWED_CONTENT_FIELDS[kind] ?? [];
  const unsupported = CONTENT_FIELD_NAMES.filter(
    (field) => input[field] !== undefined && !allowed.includes(field),
  );

  if (unsupported.length > 0) {
    throw new Error(
      `${where}: ${kind} items do not support ${unsupported.join(', ')}.${
        allowed.length > 0
          ? ` Supported fields: ${allowed.join(', ')}.`
          : ' Only position, size and z_index can change.'
      }`,
    );
  }
}

/** Map provided snake_case content fields onto stored (camelCase) data. */
function applyContentFields(
  data: CanvasRowData,
  fields: ContentFields,
): CanvasRowData {
  const next = { ...data };
  if (fields.text !== undefined) next.text = fields.text;
  if (fields.title !== undefined) next.title = fields.title;
  if (fields.description !== undefined) next.description = fields.description;
  if (fields.label !== undefined) next.label = fields.label;
  if (fields.url !== undefined) next.url = fields.url;
  if (fields.color !== undefined) next.color = fields.color;
  if (fields.shape !== undefined) next.shape = fields.shape;
  if (fields.font_size !== undefined) next.fontSize = fields.font_size;
  if (fields.bold !== undefined) next.bold = fields.bold;
  if (fields.italic !== undefined) next.italic = fields.italic;
  if (fields.stroke_width !== undefined) next.strokeWidth = fields.stroke_width;
  return next;
}

export type CanvasProject = {
  id: string;
  account_id: string;
  name: string | null;
};

export async function loadCanvasProject(
  supabase: SupabaseClient,
  projectId: string,
  mode: 'view' | 'edit',
): Promise<CanvasProject> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, title, account_id, project_type')
    .eq('id', projectId)
    .maybeSingle();

  assertSupabaseOk(data, error, 'resolve project');

  const project = data as {
    id: string;
    name?: string | null;
    title?: string | null;
    account_id?: string | null;
    project_type?: string | null;
  } | null;

  if (!project?.account_id) {
    throw new Error('Project not found');
  }

  if (project.project_type !== 'delivery') {
    throw new Error('Canvas is only available on delivery projects');
  }

  if (mode === 'edit') {
    const { data: canEdit, error: rpcError } = await supabase.rpc(
      'can_edit_project_canvas',
      { p_account_id: project.account_id },
    );
    assertSupabaseOk(canEdit, rpcError, 'check canvas permission');
    if (canEdit !== true) {
      throw new Error('You do not have permission to edit this project canvas');
    }
  } else {
    const { data: canView, error: rpcError } = await supabase.rpc(
      'can_view_project_canvas',
      { p_project_id: project.id },
    );
    assertSupabaseOk(canView, rpcError, 'check canvas access');
    if (canView !== true) {
      throw new Error('You do not have access to this project canvas');
    }
  }

  return {
    id: project.id,
    account_id: project.account_id,
    name: project.name?.trim() || project.title?.trim() || null,
  };
}

export async function loadCanvasRows(
  supabase: SupabaseClient,
  projectId: string,
): Promise<CanvasRow[]> {
  const { data, error } = await supabase
    .from('project_canvas_items')
    .select(CANVAS_ITEM_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(2000);

  assertSupabaseOk(data, error, 'load canvas items');
  return (data ?? []) as CanvasRow[];
}

/** Live labels for linked cards so the agent can tell what they are. */
async function loadLinkedLabels(
  supabase: SupabaseClient,
  rows: CanvasRow[],
): Promise<Map<string, string>> {
  const idsFor = (kind: string) => [
    ...new Set(
      rows
        .filter((row) => row.kind === kind && row.ref_id)
        .map((row) => row.ref_id as string),
    ),
  ];
  const lookups = [
    { kind: 'phase', table: 'project_phases', column: 'name' },
    { kind: 'task', table: 'tasks', column: 'title' },
    { kind: 'note', table: 'notes', column: 'title' },
  ];

  const labels = new Map<string, string>();
  await Promise.all(
    lookups.map(async ({ kind, table, column }) => {
      const ids = idsFor(kind);
      if (ids.length === 0) {
        return;
      }

      const { data, error } = await supabase
        .from(table)
        .select(`id, ${column}`)
        .in('id', ids);
      if (error) {
        console.warn(
          `[ozer-mcp] could not load ${table} labels:`,
          error.message,
        );
        return;
      }

      for (const record of (data ?? []) as unknown as Array<
        Record<string, string | null>
      >) {
        const label = record[column]?.trim();
        if (record.id && label) {
          labels.set(`${kind}:${record.id}`, label);
        }
      }
    }),
  );

  return labels;
}

export function mapCanvasRow(
  row: CanvasRow,
  linkedLabels?: Map<string, string>,
) {
  const data = rowData(row);
  const box = rowBox(row);
  const base = {
    id: row.id,
    kind: row.kind,
    z_index: row.z_index ?? 0,
  };

  if (isConnectorKind(row.kind)) {
    return {
      ...base,
      source: data.source ?? null,
      target: data.target ?? null,
      label: data.label ?? null,
      color: data.color ?? null,
    };
  }

  const geometry = { x: box.x, y: box.y, w: box.w, h: box.h };
  if (row.ref_id) {
    return {
      ...base,
      ...geometry,
      ref_id: row.ref_id,
      label: linkedLabels?.get(`${row.kind}:${row.ref_id}`) ?? null,
    };
  }

  return {
    ...base,
    ...geometry,
    text: data.text ?? null,
    title: data.title ?? null,
    description: data.description ?? null,
    url: data.url ?? null,
    color: data.color ?? null,
    shape: data.shape ?? null,
    font_size: data.fontSize ?? null,
    bold: data.bold ?? null,
    italic: data.italic ?? null,
    stroke_width: data.strokeWidth ?? null,
    point_count: data.points?.length ?? null,
  };
}

function requireContent(
  kind: string,
  fields: ContentFields,
  where: string,
): void {
  const missing = (field: string) => {
    throw new Error(`${where}: ${kind} items need ${field}.`);
  };

  if ((kind === 'sticky' || kind === 'text') && !fields.text?.trim()) {
    missing('text');
  }
  if (kind === 'frame' && !fields.title?.trim()) {
    missing('title');
  }
  if (kind === 'link' && !fields.url) {
    missing('url');
  }
  if (kind === 'draw' && (fields.points?.length ?? 0) < 2) {
    missing('points (at least two [x, y] pairs)');
  }
}

type DraftItem = {
  key: string | null;
  row: {
    id: string;
    kind: string;
    x: number;
    y: number;
    w: number | null;
    h: number | null;
    z_index: number;
    data: CanvasRowData;
  };
  /** Set once positioned; connectors use it to pick handles. */
  box: CanvasBox | null;
  /** Needs an auto-placement slot. */
  unplaced: boolean;
};

type AddItem = z.infer<typeof addItemSchema>;

function draftFreeformItem(
  item: AddItem,
  index: number,
  zIndexes: { container: number; item: number },
): DraftItem {
  const where = `items[${index}]`;
  assertFieldsAllowed(item.kind, item, where);
  requireContent(item.kind, item, where);

  const hasX = item.x !== undefined;
  const hasY = item.y !== undefined;
  if (hasX !== hasY) {
    throw new Error(`${where}: provide both x and y, or neither.`);
  }

  const id = crypto.randomUUID();
  const z = isContainerKind(item.kind) ? zIndexes.container++ : zIndexes.item++;

  if (item.kind === 'draw') {
    if (hasX || item.w !== undefined || item.h !== undefined) {
      throw new Error(
        `${where}: draw items are positioned by their points; omit x, y, w and h.`,
      );
    }

    const strokeWidth = item.stroke_width ?? 3;
    const stroke = normalizeStroke(item.points as CanvasPoint[], strokeWidth);
    return {
      key: item.key ?? null,
      row: {
        id,
        kind: 'draw',
        x: stroke.x,
        y: stroke.y,
        w: stroke.w,
        h: stroke.h,
        z_index: z,
        data: {
          points: stroke.points,
          color: item.color ?? 'slate',
          strokeWidth,
        },
      },
      box: { x: stroke.x, y: stroke.y, w: stroke.w, h: stroke.h },
      unplaced: false,
    };
  }

  const fallback = CANVAS_DEFAULT_SIZES[item.kind] ?? { w: 200, h: 100 };
  const w = item.w ?? fallback.w;
  let h = item.h ?? fallback.h;

  const base: CanvasRowData = {};
  if (item.kind === 'sticky') {
    base.color = 'yellow';
  } else if (item.kind === 'shape') {
    base.color = 'blue';
    base.shape = 'rectangle';
  } else if (item.kind === 'frame') {
    base.color = 'slate';
  }
  const data = applyContentFields(base, item);

  if (
    item.h === undefined &&
    (item.kind === 'sticky' || item.kind === 'text')
  ) {
    h = estimateTextHeight(
      item.text ?? '',
      w,
      data.fontSize ?? (item.kind === 'text' ? 20 : 14),
      fallback.h,
      item.kind === 'sticky' ? 32 : 8,
    );
  }

  return {
    key: item.key ?? null,
    row: {
      id,
      kind: item.kind,
      x: item.x ?? 0,
      y: item.y ?? 0,
      w,
      h,
      z_index: z,
      data,
    },
    box: hasX ? { x: item.x!, y: item.y!, w, h } : null,
    unplaced: !hasX,
  };
}

/**
 * Turn connector items into rows, resolving source/target to ids from the
 * existing canvas or other items in the same call.
 */
function draftConnector(
  item: AddItem,
  index: number,
  lookup: {
    byKey: Map<string, DraftItem>;
    existing: Map<string, CanvasRow>;
    existingConnectors: Set<string>;
    drafted: Set<string>;
  },
): DraftItem {
  const where = `items[${index}]`;
  assertFieldsAllowed('connector', item, where);

  if (!item.source || !item.target) {
    throw new Error(`${where}: connector items need source and target.`);
  }
  if (
    item.x !== undefined ||
    item.y !== undefined ||
    item.w !== undefined ||
    item.h !== undefined
  ) {
    throw new Error(
      `${where}: connectors follow their items; omit x, y, w and h.`,
    );
  }

  const resolve = (ref: string, field: string) => {
    const keyed = lookup.byKey.get(ref);
    if (keyed) {
      if (keyed.row.kind === 'connector') {
        throw new Error(`${where}: ${field} cannot be another connector.`);
      }
      return { id: keyed.row.id, box: keyed.box };
    }

    const existing = lookup.existing.get(ref);
    if (!existing) {
      throw new Error(
        `${where}: ${field} "${ref}" is neither an item on this canvas nor a key in this call.`,
      );
    }
    if (isConnectorKind(existing.kind)) {
      throw new Error(`${where}: ${field} cannot be another connector.`);
    }
    return { id: existing.id, box: rowBox(existing) };
  };

  const source = resolve(item.source, 'source');
  const target = resolve(item.target, 'target');

  if (source.id === target.id) {
    throw new Error(`${where}: a connector cannot join an item to itself.`);
  }

  const pair = `${source.id}>${target.id}`;
  if (lookup.existingConnectors.has(pair) || lookup.drafted.has(pair)) {
    throw new Error(`${where}: these items are already connected that way.`);
  }
  lookup.drafted.add(pair);

  // Boxes are only missing for auto-placed items; callers resolve connectors
  // after positioning, so fall back defensively.
  const handles =
    source.box && target.box
      ? pickConnectorHandles(source.box, target.box)
      : { sourceHandle: 'right', targetHandle: 'left' };

  return {
    key: item.key ?? null,
    row: {
      id: crypto.randomUUID(),
      kind: 'connector',
      x: 0,
      y: 0,
      w: null,
      h: null,
      z_index: 0,
      data: applyContentFields(
        {
          source: source.id,
          target: target.id,
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          color: 'slate',
        },
        item,
      ),
    },
    box: null,
    unplaced: false,
  };
}

/** Build every row for an add call without touching the database. */
export function buildCanvasAdditions(
  items: AddItem[],
  existingRows: CanvasRow[],
): DraftItem[] {
  const zIndexes = nextZIndexes(existingRows);
  const drafts: Array<DraftItem | null> = items.map((item, index) =>
    item.kind === 'connector' ? null : draftFreeformItem(item, index, zIndexes),
  );

  const byKey = new Map<string, DraftItem>();
  const seenKeys = new Set<string>();
  items.forEach((item, index) => {
    if (!item.key) {
      return;
    }
    if (seenKeys.has(item.key)) {
      throw new Error(`items[${index}]: duplicate key "${item.key}".`);
    }
    seenKeys.add(item.key);

    const draft = drafts[index];
    if (draft) {
      byKey.set(item.key, draft);
    }
  });

  // Auto-place unplaced items in a row below existing content.
  const unplaced = drafts.filter(
    (draft): draft is DraftItem => draft !== null && draft.unplaced,
  );
  const placements = flowPlacements(
    unplaced.map((draft) => ({
      w: draft.row.w ?? 0,
      h: draft.row.h ?? 0,
    })),
    canvasContentBounds(existingRows),
  );
  unplaced.forEach((draft, i) => {
    const position = placements[i]!;
    draft.row.x = position.x;
    draft.row.y = position.y;
    draft.box = {
      x: position.x,
      y: position.y,
      w: draft.row.w ?? 0,
      h: draft.row.h ?? 0,
    };
    draft.unplaced = false;
  });

  const existing = new Map(existingRows.map((row) => [row.id, row]));
  const existingConnectors = new Set(
    existingRows
      .filter((row) => isConnectorKind(row.kind))
      .map((row) => {
        const data = rowData(row);
        return `${data.source}>${data.target}`;
      }),
  );
  const drafted = new Set<string>();

  return items.map((item, index) => {
    const draft = drafts[index];
    if (draft) {
      return draft;
    }

    return draftConnector(item, index, {
      byKey,
      existing,
      existingConnectors,
      drafted,
    });
  });
}

type UpdateItem = z.infer<typeof updateItemSchema>;

/** Validate a patch against the stored row and return the columns to write. */
export function buildCanvasUpdate(
  row: CanvasRow,
  patch: UpdateItem,
  index: number,
): Record<string, unknown> {
  const where = `items[${index}] (${row.id})`;
  assertFieldsAllowed(row.kind, patch, where);

  const update: Record<string, unknown> = {};
  const hasGeometry =
    patch.x !== undefined ||
    patch.y !== undefined ||
    patch.w !== undefined ||
    patch.h !== undefined;

  if (
    isConnectorKind(row.kind) &&
    (hasGeometry || patch.z_index !== undefined)
  ) {
    throw new Error(
      `${where}: connectors follow their items; they have no position.`,
    );
  }

  if (patch.points !== undefined) {
    if (row.kind !== 'draw') {
      throw new Error(`${where}: only draw items have points.`);
    }
    if (hasGeometry) {
      throw new Error(
        `${where}: points set a draw item's position; omit x, y, w and h.`,
      );
    }
  }

  if (
    row.kind === 'draw' &&
    hasGeometry &&
    (patch.w !== undefined || patch.h !== undefined)
  ) {
    throw new Error(
      `${where}: draw items cannot be resized; move them with x and y.`,
    );
  }

  if (patch.x !== undefined) update.x = patch.x;
  if (patch.y !== undefined) update.y = patch.y;
  if (patch.w !== undefined) update.w = patch.w;
  if (patch.h !== undefined) update.h = patch.h;
  if (patch.z_index !== undefined) update.z_index = patch.z_index;

  let data = applyContentFields(rowData(row), patch);

  if (patch.points !== undefined) {
    const strokeWidth = patch.stroke_width ?? data.strokeWidth ?? 3;
    const stroke = normalizeStroke(patch.points as CanvasPoint[], strokeWidth);
    Object.assign(update, {
      x: stroke.x,
      y: stroke.y,
      w: stroke.w,
      h: stroke.h,
    });
    data = { ...data, points: stroke.points, strokeWidth };
  }

  const contentChanged = CONTENT_FIELD_NAMES.some(
    (field) => (patch as Record<string, unknown>)[field] !== undefined,
  );
  if (contentChanged) {
    update.data = data;
  }

  if (Object.keys(update).length === 0) {
    throw new Error(`${where}: provide at least one field to change.`);
  }

  return update;
}

export type CarryMove = { id: string; dx: number; dy: number };

/**
 * Items carried along when containers move. Mirrors the editor
 * (apps/web/lib/projects/canvas/canvas-geometry.ts `itemsInsideContainer`):
 * an item whose centre sits inside the container's pre-move box travels with
 * it; a nested container travels only if smaller than its parent. When
 * several moving containers hold an item, the smallest one wins.
 */
export function planContainerCarries(
  rows: CanvasRow[],
  moves: CarryMove[],
  skipIds: Set<string>,
): Array<{ row: CanvasRow; x: number; y: number }> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const containers = moves
    .map((move) => ({ move, row: byId.get(move.id) }))
    .filter(
      (entry): entry is { move: CarryMove; row: CanvasRow } =>
        entry.row != null && isContainerKind(entry.row.kind),
    )
    .map((entry) => ({ ...entry, box: rowBox(entry.row) }));

  const result = new Map<
    string,
    { row: CanvasRow; x: number; y: number; area: number }
  >();

  for (const row of rows) {
    if (isConnectorKind(row.kind) || skipIds.has(row.id)) continue;
    const inner = rowBox(row);
    const cx = inner.x + inner.w / 2;
    const cy = inner.y + inner.h / 2;

    for (const { move, row: container, box } of containers) {
      if (container.id === row.id) continue;
      if (isContainerKind(row.kind) && inner.w * inner.h >= box.w * box.h) {
        continue;
      }
      if (
        cx < box.x ||
        cx > box.x + box.w ||
        cy < box.y ||
        cy > box.y + box.h
      ) {
        continue;
      }
      const area = box.w * box.h;
      const current = result.get(row.id);
      if (!current || area < current.area) {
        result.set(row.id, {
          row,
          x: inner.x + move.dx,
          y: inner.y + move.dy,
          area,
        });
      }
    }
  }

  return [...result.values()].map(({ row, x, y }) => ({ row, x, y }));
}

function describeLinkedKinds() {
  return LINKED_CANVAS_KINDS.join(', ');
}

export const registerCanvasTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'get_project_canvas',
    {
      description: `Read a delivery project's shared canvas (whiteboard). Returns every item with position (x, y, w, h in canvas px, y grows downward), stacking order and content: freeform items (sticky, text, shape, frame, link, draw, timeline, image) carry their text/colour/etc., linked cards (${describeLinkedKinds()}) carry ref_id and a live label, and connectors carry source/target item ids. Also returns content bounds so you can place new items. Draw items return point_count only. Linked labels are resolved for phase, task and note cards; member, client, contact and doc cards return ref_id with label null.`,
      inputSchema: getProjectCanvasSchema,
    },
    async (input) => {
      const project = await loadCanvasProject(
        supabase,
        input.project_id,
        'view',
      );
      const rows = await loadCanvasRows(supabase, project.id);
      const kinds = input.kinds ? new Set(input.kinds) : null;
      const filtered = kinds ? rows.filter((row) => kinds.has(row.kind)) : rows;
      const returned = filtered.slice(0, MAX_CANVAS_ITEMS_RETURNED);
      const labels = await loadLinkedLabels(supabase, returned);

      const counts: Record<string, number> = {};
      for (const row of rows) {
        counts[row.kind] = (counts[row.kind] ?? 0) + 1;
      }

      return toolJson({
        project: { id: project.id, name: project.name },
        bounds: canvasContentBounds(rows),
        counts,
        total_count: filtered.length,
        truncated: filtered.length > returned.length,
        items: returned.map((row) => mapCanvasRow(row, labels)),
      });
    },
  );

  server.registerTool(
    'add_canvas_items',
    {
      description:
        "Add items to a delivery project's shared canvas: sticky notes, free text, shapes (rectangle/ellipse/diamond), frames (titled sections), link cards, freehand drawings (draw, from a list of [x, y] points), and connector arrows between items. Changes appear live for people viewing the canvas. Call get_project_canvas first to see existing content and bounds. Omit x/y to auto-place new items in a row below existing content; or pass x/y to lay things out yourself (canvas px, y grows downward; stickies are 200×200, text 240×48, shapes 180×120, frames 480×320 by default). To draw a line, arrow or shape outline, use draw with points; to join two items, use connector with source/target (item ids or keys from this call). Give items a key to connect them in the same call. Frames render behind other items and carry items inside them when moved, so create the frame first, then place items within its bounds. To put task, phase or note cards on the canvas at a position use place_canvas_cards; to remove items use delete_canvas_items; to show a dependency between tasks use link_tasks.",
      inputSchema: addCanvasItemsSchema,
    },
    async (input) => {
      const project = await loadCanvasProject(
        supabase,
        input.project_id,
        'edit',
      );
      const existing = await loadCanvasRows(supabase, project.id);
      const drafts = buildCanvasAdditions(input.items, existing);

      const { data, error } = await supabase
        .from('project_canvas_items')
        .insert(
          drafts.map((draft) => ({
            ...draft.row,
            ref_id: null,
            account_id: project.account_id,
            project_id: project.id,
            updated_by: userId,
          })),
        )
        .select(CANVAS_ITEM_COLUMNS);

      assertSupabaseOk(data, error, 'add canvas items');

      const created = (data ?? []) as CanvasRow[];
      const createdById = new Map(created.map((row) => [row.id, row]));
      const keys: Record<string, string> = {};
      for (const draft of drafts) {
        if (draft.key) {
          keys[draft.key] = draft.row.id;
        }
      }

      const placed = boundsOf(
        created.filter((row) => !isConnectorKind(row.kind)).map(rowBox),
      );

      return toolJson({
        project: { id: project.id, name: project.name },
        created_count: created.length,
        keys,
        added_bounds: placed,
        items: drafts.map((draft) =>
          mapCanvasRow(
            createdById.get(draft.row.id) ?? (draft.row as CanvasRow),
          ),
        ),
      });
    },
  );

  server.registerTool(
    'update_canvas_items',
    {
      description:
        "Edit items already on a delivery project's shared canvas (ids from get_project_canvas). Only provided fields change. Any item can be moved, resized or restacked (x, y, w, h, z_index); freeform items can also change content: text/colour/font for sticky, text, shape and frame (frames use title), url/title/description for links, points/colour/stroke_width for drawings (new points replace the stroke), colour/label for connectors. Moving a frame or phase (x/y) also moves the items inside it, like dragging it in the editor (move_contents, default true; carried_with_container reports how many). Linked cards (tasks, phases, notes, …) can only be moved/resized; edit the underlying record with its own tool. Every patch is validated before any is applied; writes then run one at a time and stop at the first failure (not transactional).",
      inputSchema: updateCanvasItemsSchema,
    },
    async (input) => {
      const ids = [...new Set(input.items.map((item) => item.id))];
      if (ids.length !== input.items.length) {
        throw new Error('Each item id may appear only once per call.');
      }

      const { data, error } = await supabase
        .from('project_canvas_items')
        .select(`${CANVAS_ITEM_COLUMNS}, project_id, account_id`)
        .in('id', ids);

      assertSupabaseOk(data, error, 'load canvas items');

      const rows = (data ?? []) as Array<
        CanvasRow & { project_id: string; account_id: string }
      >;
      const rowsById = new Map(rows.map((row) => [row.id, row]));

      const projectIds = [...new Set(rows.map((row) => row.project_id))];
      await Promise.all(
        projectIds.map((projectId) =>
          loadCanvasProject(supabase, projectId, 'edit'),
        ),
      );

      const updates = input.items.map((patch, index) => {
        const row = rowsById.get(patch.id);
        if (!row) {
          throw new Error(
            `items[${index}]: canvas item ${patch.id} not found or not accessible.`,
          );
        }

        return { row, update: buildCanvasUpdate(row, patch, index) };
      });

      let carried = 0;
      if (input.move_contents) {
        const moves: CarryMove[] = [];
        for (const { row } of updates) {
          const patch = input.items.find((item) => item.id === row.id);
          if (!patch || !isContainerKind(row.kind)) continue;
          const dx = patch.x !== undefined ? patch.x - (Number(row.x) || 0) : 0;
          const dy = patch.y !== undefined ? patch.y - (Number(row.y) || 0) : 0;
          if (dx !== 0 || dy !== 0) moves.push({ id: row.id, dx, dy });
        }

        if (moves.length > 0) {
          const moved = new Set(ids);
          const moveProjects = [
            ...new Set(moves.map((move) => rowsById.get(move.id)!.project_id)),
          ];
          const { data: all, error: allError } = await supabase
            .from('project_canvas_items')
            .select(`${CANVAS_ITEM_COLUMNS}, project_id, account_id`)
            .in('project_id', moveProjects);
          assertSupabaseOk(all, allError, 'load canvas contents');

          const everything = (all ?? []) as Array<
            CanvasRow & { project_id: string; account_id: string }
          >;
          // Contents are matched within each container's own project.
          for (const projectId of moveProjects) {
            const inProject = everything.filter(
              (row) => row.project_id === projectId,
            );
            const projectMoves = moves.filter(
              (move) => rowsById.get(move.id)!.project_id === projectId,
            );
            for (const carry of planContainerCarries(
              inProject,
              projectMoves,
              moved,
            )) {
              updates.push({
                row: carry.row as (typeof inProject)[number],
                update: { x: carry.x, y: carry.y },
              });
              carried += 1;
            }
          }
        }
      }

      // Sequential so a failure stops the batch; PostgREST has no
      // multi-row transaction, so earlier patches stay applied.
      const results: CanvasRow[] = [];
      for (const { row, update } of updates) {
        const { data: saved, error: updateError } = await supabase
          .from('project_canvas_items')
          .update({ ...update, updated_by: userId })
          .eq('id', row.id)
          .select(CANVAS_ITEM_COLUMNS)
          .maybeSingle();

        if (updateError || !saved) {
          const applied =
            results.length > 0
              ? ` ${results.length} earlier item(s) were already updated: ${results.map((r) => r.id).join(', ')}.`
              : '';
          throw new Error(
            `Could not update canvas item ${row.id}: ${updateError?.message ?? 'item not found'}.${applied}`,
          );
        }

        results.push(saved as CanvasRow);
      }

      return toolJson({
        updated_count: results.length,
        carried_with_container: carried,
        items: results.map((row) => mapCanvasRow(row)),
      });
    },
  );
};
