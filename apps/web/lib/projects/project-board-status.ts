/**
 * In-place board helpers shared by the projects kanban and its parent list.
 * Status is a string so fixed columns and custom workspace slugs both work
 * in client state. Persist still goes through `updateJob` with workspace slugs.
 */

export function applyItemStatus<T extends { id: string; status: string }>(
  items: T[],
  itemId: string,
  status: string,
): T[] {
  return items.map((item) => (item.id === itemId ? { ...item, status } : item));
}

export function mergePendingStatuses<T extends { id: string; status: string }>(
  items: T[],
  pending: ReadonlyMap<string, string>,
): T[] {
  if (pending.size === 0) {
    return items;
  }

  return items.map((item) => {
    if (!pending.has(item.id)) {
      return item;
    }

    return { ...item, status: pending.get(item.id) as string };
  });
}
