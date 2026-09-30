import {
  type CanvasItem,
  canvasItemSize,
  isContainerCanvasKind,
} from './canvas-types';

export type CanvasHandleSide = 'top' | 'right' | 'bottom' | 'left';

export type Box = { x: number; y: number; w: number; h: number };

function boxOf(item: CanvasItem): Box {
  const { w, h } = canvasItemSize(item);
  return { x: item.x, y: item.y, w, h };
}

/**
 * Items whose centre sits inside the container, so moving a phase or frame
 * carries its contents like a Figma frame. Nested containers move too when
 * they're smaller than the parent.
 */
export function itemsInsideContainer(
  container: CanvasItem,
  items: CanvasItem[],
): CanvasItem[] {
  const outer = boxOf(container);
  return items.filter((item) => {
    if (item.id === container.id || item.kind === 'connector') return false;
    const inner = boxOf(item);
    if (
      isContainerCanvasKind(item.kind) &&
      inner.w * inner.h >= outer.w * outer.h
    ) {
      return false;
    }
    const cx = inner.x + inner.w / 2;
    const cy = inner.y + inner.h / 2;
    return (
      cx >= outer.x &&
      cx <= outer.x + outer.w &&
      cy >= outer.y &&
      cy <= outer.y + outer.h
    );
  });
}

/** Smallest phase or frame whose box contains the point. */
export function containerAt(
  point: { x: number; y: number },
  items: CanvasItem[],
  options: { kinds?: CanvasItem['kind'][]; exclude?: Set<string> } = {},
): CanvasItem | null {
  let best: CanvasItem | null = null;
  let bestArea = Infinity;
  for (const item of items) {
    if (!isContainerCanvasKind(item.kind)) continue;
    if (options.kinds && !options.kinds.includes(item.kind)) continue;
    if (options.exclude?.has(item.id)) continue;
    const box = boxOf(item);
    if (
      point.x < box.x ||
      point.x > box.x + box.w ||
      point.y < box.y ||
      point.y > box.y + box.h
    ) {
      continue;
    }
    const area = box.w * box.h;
    if (area < bestArea) {
      best = item;
      bestArea = area;
    }
  }
  return best;
}

export function canvasItemsBounds(items: CanvasItem[]): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    if (item.kind === 'connector') continue;
    const box = boxOf(item);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }
  return Number.isFinite(minX)
    ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    : null;
}

export function boxesOverlap(a: Box, b: Box) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

export function canvasItemBox(item: CanvasItem): Box {
  return boxOf(item);
}

/** Attach an arrow to the facing sides of two items. */
export function pickConnectorHandles(
  source: CanvasItem,
  target: CanvasItem,
): { sourceHandle: CanvasHandleSide; targetHandle: CanvasHandleSide } {
  const a = boxOf(source);
  const b = boxOf(target);
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' };
  }
  return dy >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' };
}
