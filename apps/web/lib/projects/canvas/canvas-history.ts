import type { CanvasItem } from './canvas-types';

/** One item's state before and after an edit (null = absent). */
export type CanvasChange = {
  before: CanvasItem | null;
  after: CanvasItem | null;
};

export type CanvasHistory = {
  past: CanvasChange[][];
  future: CanvasChange[][];
};

export const CANVAS_HISTORY_LIMIT = 100;

export function emptyCanvasHistory(): CanvasHistory {
  return { past: [], future: [] };
}

export function pushCanvasHistory(
  history: CanvasHistory,
  entry: CanvasChange[],
): CanvasHistory {
  if (entry.length === 0) return history;
  const past = [...history.past, entry].slice(-CANVAS_HISTORY_LIMIT);
  return { past, future: [] };
}

function invert(entry: CanvasChange[]): CanvasChange[] {
  return entry.map(({ before, after }) => ({ before: after, after: before }));
}

/** Returns the changes to apply to undo the last entry. */
export function undoCanvasHistory(
  history: CanvasHistory,
): { history: CanvasHistory; changes: CanvasChange[] } | null {
  const last = history.past.at(-1);
  if (!last) return null;
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, last],
    },
    changes: invert(last),
  };
}

export function redoCanvasHistory(
  history: CanvasHistory,
): { history: CanvasHistory; changes: CanvasChange[] } | null {
  const next = history.future.at(-1);
  if (!next) return null;
  return {
    history: {
      past: [...history.past, next],
      future: history.future.slice(0, -1),
    },
    changes: next,
  };
}

export function applyCanvasChanges(
  items: CanvasItem[],
  changes: CanvasChange[],
): CanvasItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const { before, after } of changes) {
    const id = after?.id ?? before?.id;
    if (!id) continue;
    if (after) byId.set(id, after);
    else byId.delete(id);
  }
  return [...byId.values()];
}

/** Split changes into rows to upsert and ids to delete. */
export function partitionCanvasChanges(changes: CanvasChange[]): {
  upserts: CanvasItem[];
  deletes: string[];
} {
  const upserts: CanvasItem[] = [];
  const deletes: string[] = [];
  for (const { before, after } of changes) {
    if (after) upserts.push(after);
    else if (before) deletes.push(before.id);
  }
  return { upserts, deletes };
}
