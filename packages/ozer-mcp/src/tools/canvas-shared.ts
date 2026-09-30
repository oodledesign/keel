/**
 * Project canvas helpers for the MCP tools.
 *
 * The canvas lives in `project_canvas_items` and is edited live by the web
 * app (apps/web/lib/projects/canvas). This package cannot import from
 * `apps/web`, so the constants below mirror `canvas-types.ts`; a test in
 * `canvas.test.ts` fails if they drift.
 */

export const CANVAS_COLOR_KEYS = [
  'yellow',
  'pink',
  'blue',
  'green',
  'orange',
  'purple',
  'coral',
  'plum',
  'slate',
] as const;
export type CanvasColorKey = (typeof CANVAS_COLOR_KEYS)[number];

export const CANVAS_SHAPE_TYPES = ['rectangle', 'ellipse', 'diamond'] as const;
export type CanvasShapeType = (typeof CANVAS_SHAPE_TYPES)[number];

/** Cards backed by a live record (phase, task, …). Not creatable from MCP. */
export const LINKED_CANVAS_KINDS = [
  'phase',
  'task',
  'member',
  'client',
  'note',
  'contact',
  'doc',
] as const;

/** Freeform kinds the MCP can create. */
export const MCP_CANVAS_CREATE_KINDS = [
  'sticky',
  'text',
  'shape',
  'frame',
  'link',
  'draw',
  'connector',
] as const;
export type McpCanvasCreateKind = (typeof MCP_CANVAS_CREATE_KINDS)[number];

export const CANVAS_DEFAULT_SIZES: Record<
  string,
  { w: number; h: number } | undefined
> = {
  phase: { w: 320, h: 260 },
  task: { w: 280, h: 76 },
  member: { w: 260, h: 104 },
  client: { w: 260, h: 88 },
  note: { w: 260, h: 140 },
  contact: { w: 260, h: 104 },
  doc: { w: 260, h: 72 },
  sticky: { w: 200, h: 200 },
  text: { w: 240, h: 48 },
  shape: { w: 180, h: 120 },
  frame: { w: 480, h: 320 },
  image: { w: 280, h: 200 },
  link: { w: 320, h: 150 },
  draw: { w: 1, h: 1 },
  timeline: { w: 1200, h: 280 },
};

export type CanvasBox = { x: number; y: number; w: number; h: number };
export type CanvasPoint = [number, number];

export type CanvasRowData = {
  text?: string;
  title?: string;
  color?: string;
  shape?: string;
  points?: CanvasPoint[];
  strokeWidth?: number;
  url?: string;
  description?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  source?: string;
  target?: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  [key: string]: unknown;
};

export type CanvasRow = {
  id: string;
  kind: string;
  ref_id: string | null;
  x: number | string;
  y: number | string;
  w: number | string | null;
  h: number | string | null;
  z_index: number | null;
  data: unknown;
  updated_at?: string | null;
};

export const CANVAS_ITEM_COLUMNS =
  'id, kind, ref_id, x, y, w, h, z_index, data, updated_at';

export function isConnectorKind(kind: string) {
  return kind === 'connector';
}

export function isContainerKind(kind: string) {
  return kind === 'phase' || kind === 'frame';
}

export function rowData(row: Pick<CanvasRow, 'data'>): CanvasRowData {
  return row.data && typeof row.data === 'object' && !Array.isArray(row.data)
    ? (row.data as CanvasRowData)
    : {};
}

export function rowBox(row: CanvasRow): CanvasBox {
  const fallback = CANVAS_DEFAULT_SIZES[row.kind] ?? { w: 200, h: 100 };
  return {
    x: Number(row.x) || 0,
    y: Number(row.y) || 0,
    w: row.w == null ? fallback.w : Number(row.w),
    h: row.h == null ? fallback.h : Number(row.h),
  };
}

export function boundsOf(boxes: CanvasBox[]): CanvasBox | null {
  if (boxes.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Bounds of everything on the canvas except connectors (which have no box). */
export function canvasContentBounds(rows: CanvasRow[]): CanvasBox | null {
  return boundsOf(
    rows.filter((row) => !isConnectorKind(row.kind)).map((row) => rowBox(row)),
  );
}

const PLACEMENT_GAP = 48;
const PLACEMENT_ITEM_GAP = 24;
const PLACEMENT_ROW_WIDTH = 1600;

/**
 * Positions for items the caller did not place: a wrapped row below the
 * existing content (or at the origin on an empty canvas).
 */
export function flowPlacements(
  sizes: Array<{ w: number; h: number }>,
  existing: CanvasBox | null,
): Array<{ x: number; y: number }> {
  const startX = existing ? Math.round(existing.x) : 0;
  let cursorY = existing
    ? Math.round(existing.y + existing.h + PLACEMENT_GAP)
    : 0;
  let cursorX = startX;
  let rowHeight = 0;

  return sizes.map((size) => {
    if (cursorX > startX && cursorX + size.w > startX + PLACEMENT_ROW_WIDTH) {
      cursorX = startX;
      cursorY += rowHeight + PLACEMENT_ITEM_GAP;
      rowHeight = 0;
    }

    const position = { x: cursorX, y: cursorY };
    cursorX += size.w + PLACEMENT_ITEM_GAP;
    rowHeight = Math.max(rowHeight, size.h);
    return position;
  });
}

/**
 * Rough height for wrapped text so long stickies/text are not clipped.
 * Never smaller than `minHeight`.
 */
export function estimateTextHeight(
  text: string,
  width: number,
  fontSize: number,
  minHeight: number,
  padding: number,
): number {
  const charsPerLine = Math.max(
    1,
    Math.floor((width - padding) / (fontSize * 0.55)),
  );
  const lines = text
    .split('\n')
    .reduce(
      (total, line) =>
        total + Math.max(1, Math.ceil(line.length / charsPerLine)),
      0,
    );

  return Math.max(minHeight, Math.ceil(lines * fontSize * 1.4 + padding));
}

/** z-index for a new item: above everything of its class (containers stay behind). */
export function nextZIndexes(rows: CanvasRow[]) {
  let container = 0;
  let item = 0;
  for (const row of rows) {
    if (isConnectorKind(row.kind)) {
      continue;
    }

    const z = row.z_index ?? 0;
    if (isContainerKind(row.kind)) {
      container = Math.max(container, z);
    } else {
      item = Math.max(item, z);
    }
  }

  return { container: container + 1, item: item + 1 };
}

export type ConnectorHandleSide = 'top' | 'right' | 'bottom' | 'left';

/** Attach an arrow to the facing sides of two items (same as the web app). */
export function pickConnectorHandles(
  source: CanvasBox,
  target: CanvasBox,
): { sourceHandle: ConnectorHandleSide; targetHandle: ConnectorHandleSide } {
  const dx = target.x + target.w / 2 - (source.x + source.w / 2);
  const dy = target.y + target.h / 2 - (source.y + source.h / 2);

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' };
  }

  return dy >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' };
}

function perpendicularDistance(
  point: CanvasPoint,
  start: CanvasPoint,
  end: CanvasPoint,
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }

  return (
    Math.abs(
      dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0],
    ) / Math.hypot(dx, dy)
  );
}

/** Ramer–Douglas–Peucker simplification (iterative). */
function simplifyPath(points: CanvasPoint[], tolerance = 1.5): CanvasPoint[] {
  if (points.length <= 2) {
    return points.slice();
  }

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const distance = perpendicularDistance(
        points[i]!,
        points[first]!,
        points[last]!,
      );
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }

    if (index !== -1 && maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

function decimatePath(points: CanvasPoint[], maxPoints: number): CanvasPoint[] {
  if (points.length <= maxPoints) {
    return points;
  }

  const step = Math.ceil((points.length - 1) / (maxPoints - 1));
  const out = points.filter((_, i) => i % step === 0);
  if (out.at(-1) !== points.at(-1)) {
    out.push(points.at(-1)!);
  }

  return out;
}

/**
 * Simplify absolute canvas-space points and return them relative to their
 * padded bounding box, which becomes the item's x/y/w/h (same as the web pen).
 */
export function normalizeStroke(
  points: CanvasPoint[],
  strokeWidth: number,
  maxPoints = 4000,
): CanvasBox & { points: CanvasPoint[] } {
  const simplified = decimatePath(
    simplifyPath(decimatePath(points, maxPoints * 2)),
    maxPoints,
  );

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of simplified) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  const pad = Math.ceil(strokeWidth / 2) + 2;
  const originX = minX - pad;
  const originY = minY - pad;

  return {
    x: originX,
    y: originY,
    w: Math.max(maxX - minX + pad * 2, 1),
    h: Math.max(maxY - minY + pad * 2, 1),
    points: simplified.map(([x, y]) => [
      Math.round((x - originX) * 10) / 10,
      Math.round((y - originY) * 10) / 10,
    ]),
  };
}
