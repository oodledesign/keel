export const LINKED_CANVAS_KINDS = [
  'phase',
  'task',
  'member',
  'client',
  'note',
  'contact',
  'doc',
] as const;

export const FREEFORM_CANVAS_KINDS = [
  'sticky',
  'text',
  'shape',
  'frame',
  'image',
  'link',
  'draw',
  'timeline',
] as const;

export const CANVAS_ITEM_KINDS = [
  ...LINKED_CANVAS_KINDS,
  ...FREEFORM_CANVAS_KINDS,
  'connector',
] as const;

export type LinkedCanvasKind = (typeof LINKED_CANVAS_KINDS)[number];
export type FreeformCanvasKind = (typeof FREEFORM_CANVAS_KINDS)[number];
export type CanvasItemKind = (typeof CANVAS_ITEM_KINDS)[number];

export function isCanvasItemKind(value: unknown): value is CanvasItemKind {
  return (
    typeof value === 'string' &&
    (CANVAS_ITEM_KINDS as readonly string[]).includes(value)
  );
}

export type CanvasShapeType = 'rectangle' | 'ellipse' | 'diamond';

/** Sections created from a template remember it so they can be re-laid out. */
export const CANVAS_SECTION_PRESETS = [
  'team',
  'marketing',
  'brief',
  'content_calendar',
] as const;
export type CanvasSectionPreset = (typeof CANVAS_SECTION_PRESETS)[number];

export const CANVAS_SHAPE_TYPES: CanvasShapeType[] = [
  'rectangle',
  'ellipse',
  'diamond',
];

/** Freeform content. Keys are optional; each kind reads what it needs. */
export type CanvasItemData = {
  text?: string;
  color?: CanvasColorKey;
  shape?: CanvasShapeType;
  /** Freehand points relative to the item's x/y. */
  points?: Array<[number, number]>;
  strokeWidth?: number;
  url?: string;
  /** Uploaded image in the `project-canvas` bucket: `{account}/{project}/{file}`. */
  path?: string;
  title?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  preset?: CanvasSectionPreset;
  /** Timeline: plot task due dates on the phase rows. */
  showTasks?: boolean;
  /** Link card preview, fetched when the card is added. */
  description?: string;
  faviconUrl?: string;
  imageUrl?: string;
  /** Link card saved to the project's links in Notes (`workspace_links.id`). */
  linkId?: string;
  /** Connector endpoints are canvas item ids. */
  source?: string;
  target?: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
};

export type CanvasItem = {
  id: string;
  kind: CanvasItemKind;
  refId: string | null;
  x: number;
  y: number;
  w: number | null;
  h: number | null;
  zIndex: number;
  data: CanvasItemData;
  updatedAt: string;
  updatedBy: string | null;
};

export type CanvasColorKey =
  | 'yellow'
  | 'pink'
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'coral'
  | 'plum'
  | 'slate';

/** User-pickable palette for stickies, shapes, pen strokes and arrows. */
export const CANVAS_COLORS: Record<
  CanvasColorKey,
  { label: string; fill: string; stroke: string; text: string }
> = {
  yellow: {
    label: 'Yellow',
    fill: '#FDE68A',
    stroke: '#CA8A04',
    text: '#422006',
  },
  pink: { label: 'Pink', fill: '#FBCFE8', stroke: '#DB2777', text: '#500724' },
  blue: { label: 'Blue', fill: '#BFDBFE', stroke: '#2563EB', text: '#172554' },
  green: {
    label: 'Green',
    fill: '#BBF7D0',
    stroke: '#16A34A',
    text: '#052E16',
  },
  orange: {
    label: 'Orange',
    fill: '#FED7AA',
    stroke: '#EA580C',
    text: '#431407',
  },
  purple: {
    label: 'Purple',
    fill: '#DDD6FE',
    stroke: '#7C3AED',
    text: '#2E1065',
  },
  coral: {
    label: 'Coral',
    fill: '#FFD2C7',
    stroke: '#FF5C34',
    text: '#4A1406',
  },
  plum: { label: 'Plum', fill: '#E7D9DF', stroke: '#351E28', text: '#351E28' },
  slate: {
    label: 'Slate',
    fill: '#E2E8F0',
    stroke: '#475569',
    text: '#0F172A',
  },
};

export const CANVAS_COLOR_KEYS = Object.keys(CANVAS_COLORS) as CanvasColorKey[];

export function canvasColor(
  key: CanvasColorKey | undefined,
  fallback: CanvasColorKey,
) {
  return CANVAS_COLORS[key && key in CANVAS_COLORS ? key : fallback];
}

export const CANVAS_TEXT_KINDS = ['sticky', 'text', 'shape', 'frame'] as const;
export type CanvasTextKind = (typeof CANVAS_TEXT_KINDS)[number];

export function isCanvasTextKind(kind: string): kind is CanvasTextKind {
  return (CANVAS_TEXT_KINDS as readonly string[]).includes(kind);
}

export const CANVAS_FONT_SIZES = [12, 14, 16, 20, 24, 32, 40, 48, 64, 80];

const TEXT_STYLE_DEFAULTS: Record<
  CanvasTextKind,
  { fontSize: number; bold: boolean }
> = {
  text: { fontSize: 20, bold: true },
  sticky: { fontSize: 14, bold: false },
  shape: { fontSize: 14, bold: false },
  frame: { fontSize: 16, bold: true },
};

export type CanvasTextStyle = {
  fontSize: number;
  bold: boolean;
  italic: boolean;
};

export function canvasTextStyle(
  kind: CanvasTextKind,
  data: CanvasItemData,
): CanvasTextStyle {
  const defaults = TEXT_STYLE_DEFAULTS[kind];
  return {
    fontSize: data.fontSize ?? defaults.fontSize,
    bold: data.bold ?? defaults.bold,
    italic: data.italic ?? false,
  };
}

export function isLinkedCanvasKind(kind: string): kind is LinkedCanvasKind {
  return (LINKED_CANVAS_KINDS as readonly string[]).includes(kind);
}

/** Phases and frames render behind other items and carry their contents when moved. */
export function isContainerCanvasKind(kind: CanvasItemKind) {
  return kind === 'phase' || kind === 'frame';
}

export const CANVAS_DEFAULT_SIZES: Record<
  Exclude<CanvasItemKind, 'connector'>,
  { w: number; h: number }
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

export function canvasItemSize(item: Pick<CanvasItem, 'kind' | 'w' | 'h'>) {
  if (item.kind === 'connector') return { w: 0, h: 0 };
  const fallback = CANVAS_DEFAULT_SIZES[item.kind];
  return { w: item.w ?? fallback.w, h: item.h ?? fallback.h };
}

type CanvasItemRow = {
  id: string;
  kind: string;
  ref_id: string | null;
  x: number | string;
  y: number | string;
  w: number | string | null;
  h: number | string | null;
  z_index: number | null;
  data: unknown;
  updated_at: string;
  updated_by: string | null;
};

export function canvasItemFromRow(row: Record<string, unknown>): CanvasItem {
  const r = row as unknown as CanvasItemRow;
  const toNum = (value: number | string | null) =>
    value == null ? null : Number(value);
  return {
    id: r.id,
    kind: r.kind as CanvasItemKind,
    refId: r.ref_id ?? null,
    x: Number(r.x) || 0,
    y: Number(r.y) || 0,
    w: toNum(r.w),
    h: toNum(r.h),
    zIndex: r.z_index ?? 0,
    data:
      r.data && typeof r.data === 'object' && !Array.isArray(r.data)
        ? (r.data as CanvasItemData)
        : {},
    updatedAt: r.updated_at,
    updatedBy: r.updated_by ?? null,
  };
}
