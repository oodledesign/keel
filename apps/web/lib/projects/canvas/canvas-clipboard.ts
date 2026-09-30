import { type Box, boxesOverlap, canvasItemsBounds } from './canvas-geometry';
import { PENDING_CANVAS_TIMESTAMP } from './canvas-layout';
import {
  type CanvasItem,
  FREEFORM_CANVAS_KINDS,
  isContainerCanvasKind,
} from './canvas-types';

export const CANVAS_CLIPBOARD_MIME = 'application/x-ozer-canvas+json';
const MAX_CLIPBOARD_ITEMS = 500;

export type CanvasClipboard = {
  v: 1;
  accountId: string;
  projectId: string;
  items: CanvasItem[];
};

const COPYABLE_KINDS = new Set<string>(FREEFORM_CANVAS_KINDS);

/**
 * Freeform items in the selection plus arrows joining two of them. Project
 * cards (tasks, notes, people…) exist once per canvas, so they're left out.
 */
export function copyCanvasItems(
  selected: CanvasItem[],
  all: CanvasItem[],
): CanvasItem[] {
  const picked = selected.filter((item) => COPYABLE_KINDS.has(item.kind));
  const ids = new Set(picked.map((item) => item.id));
  const connectors = all.filter(
    (item) =>
      item.kind === 'connector' &&
      ids.has(item.data.source ?? '') &&
      ids.has(item.data.target ?? ''),
  );
  return [...picked, ...connectors];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isClipboardItem(value: unknown): value is CanvasItem {
  if (!isRecord(value)) return false;
  const kind = value.kind;
  const size = (v: unknown) =>
    v === null || (typeof v === 'number' && Number.isFinite(v));
  return (
    typeof value.id === 'string' &&
    typeof kind === 'string' &&
    (COPYABLE_KINDS.has(kind) || kind === 'connector') &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    size(value.w) &&
    size(value.h) &&
    Number.isFinite(value.zIndex) &&
    isRecord(value.data)
  );
}

export function parseCanvasClipboard(raw: string): CanvasClipboard | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isRecord(parsed) ||
    parsed.v !== 1 ||
    typeof parsed.accountId !== 'string' ||
    typeof parsed.projectId !== 'string' ||
    !Array.isArray(parsed.items) ||
    parsed.items.length > MAX_CLIPBOARD_ITEMS
  ) {
    return null;
  }
  const items = parsed.items.filter(isClipboardItem);
  if (items.length === 0) return null;
  return {
    v: 1,
    accountId: parsed.accountId,
    projectId: parsed.projectId,
    items,
  };
}

/**
 * Where pasted items land: offset from the originals while they're on screen
 * in the same project, otherwise centred in the current view.
 */
export function canvasPasteOffset(
  items: CanvasItem[],
  viewport: Box,
  options: { sameProject: boolean; nudge: number },
): { dx: number; dy: number } {
  const bounds = canvasItemsBounds(items);
  if (!bounds) return { dx: options.nudge, dy: options.nudge };
  if (options.sameProject && boxesOverlap(bounds, viewport)) {
    return { dx: options.nudge, dy: options.nudge };
  }
  return {
    dx: Math.round(viewport.x + viewport.w / 2 - (bounds.x + bounds.w / 2)),
    dy: Math.round(viewport.y + viewport.h / 2 - (bounds.y + bounds.h / 2)),
  };
}

/**
 * Fresh copies of clipboard items, moved by the offset and stacked on top in
 * their original order, with arrows rewired to the copies.
 */
export function pasteCanvasItems(
  items: CanvasItem[],
  options: {
    dx: number;
    dy: number;
    newId: () => string;
    /** Next free z-index for containers (true) or other items (false). */
    zBase: (container: boolean) => number;
    /** Keep "saved to notes" markers on link cards (same project only). */
    keepLinkIds: boolean;
  },
): CanvasItem[] {
  const idMap = new Map<string, string>();
  const rank = { container: 0, item: 0 };
  const shapes = items
    .filter((item) => item.kind !== 'connector')
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((item): CanvasItem => {
      const id = options.newId();
      idMap.set(item.id, id);
      const container = isContainerCanvasKind(item.kind);
      const zIndex =
        options.zBase(container) + (container ? rank.container++ : rank.item++);
      const { linkId, ...data } = item.data;
      return {
        ...item,
        id,
        refId: null,
        x: Math.round(item.x + options.dx),
        y: Math.round(item.y + options.dy),
        zIndex,
        data: options.keepLinkIds && linkId ? { ...data, linkId } : data,
        updatedAt: PENDING_CANVAS_TIMESTAMP,
        updatedBy: null,
      };
    });

  const connectors = items
    .filter(
      (item) =>
        item.kind === 'connector' &&
        idMap.has(item.data.source ?? '') &&
        idMap.has(item.data.target ?? ''),
    )
    .map(
      (item): CanvasItem => ({
        ...item,
        id: options.newId(),
        refId: null,
        data: {
          ...item.data,
          source: idMap.get(item.data.source ?? ''),
          target: idMap.get(item.data.target ?? ''),
        },
        updatedAt: PENDING_CANVAS_TIMESTAMP,
        updatedBy: null,
      }),
    );

  return [...shapes, ...connectors];
}
