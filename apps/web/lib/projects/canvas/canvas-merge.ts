import type { CanvasItem } from './canvas-types';

/**
 * Merge incoming items by id. Server `updated_at` is the ordering authority:
 * an incoming item only replaces a newer local copy when `force` is set
 * (e.g. the response to our own write).
 */
export function mergeCanvasItems(
  current: CanvasItem[],
  incoming: CanvasItem[],
  options: { force?: boolean } = {},
): CanvasItem[] {
  if (incoming.length === 0) return current;

  const byId = new Map(current.map((item) => [item.id, item]));
  let changed = false;

  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (
      !existing ||
      options.force ||
      Date.parse(item.updatedAt) > Date.parse(existing.updatedAt) ||
      Number.isNaN(Date.parse(existing.updatedAt))
    ) {
      byId.set(item.id, item);
      changed = true;
    }
  }

  return changed ? [...byId.values()] : current;
}

export function removeCanvasItems(
  current: CanvasItem[],
  ids: Iterable<string>,
): CanvasItem[] {
  const drop = new Set(ids);
  if (drop.size === 0) return current;
  const next = current.filter((item) => !drop.has(item.id));
  return next.length === current.length ? current : next;
}

/** Connectors whose source or target is among `ids`. */
export function connectorsTouching(
  items: CanvasItem[],
  ids: Iterable<string>,
): CanvasItem[] {
  const set = new Set(ids);
  return items.filter(
    (item) =>
      item.kind === 'connector' &&
      ((item.data.source && set.has(item.data.source)) ||
        (item.data.target && set.has(item.data.target))),
  );
}

export function canConnectCanvasItems(
  items: CanvasItem[],
  source: string,
  target: string,
): boolean {
  if (!source || !target || source === target) return false;
  const byId = new Map(items.map((item) => [item.id, item]));
  const a = byId.get(source);
  const b = byId.get(target);
  if (!a || !b || a.kind === 'connector' || b.kind === 'connector') {
    return false;
  }
  return !items.some(
    (item) =>
      item.kind === 'connector' &&
      item.data.source === source &&
      item.data.target === target,
  );
}
