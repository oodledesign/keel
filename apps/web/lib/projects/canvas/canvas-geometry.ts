import {
  type CanvasItem,
  canvasItemSize,
  isContainerCanvasKind,
} from './canvas-types';

export type CanvasHandleSide = 'top' | 'right' | 'bottom' | 'left';

type Box = { x: number; y: number; w: number; h: number };

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
