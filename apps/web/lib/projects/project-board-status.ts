/**
 * In-place board helpers shared by the projects kanban and its parent list.
 * Status is a string so fixed columns and custom workspace slugs (#105) both work.
 */

export function applyItemStatus<T extends { id: string; status: string }>(
  items: T[],
  itemId: string,
  status: string,
): T[] {
  return items.map((item) =>
    item.id === itemId ? { ...item, status } : item,
  );
}

export function mergePendingStatuses<T extends { id: string; status: string }>(
  items: T[],
  pending: ReadonlyMap<string, string>,
): T[] {
  if (pending.size === 0) {
    return items;
  }

  return items.map((item) => {
    const status = pending.get(item.id);
    return status ? { ...item, status } : item;
  });
}

export function itemsStatusKey(
  items: ReadonlyArray<{ id: string; status: string }>,
): string {
  return items.map((item) => `${item.id}:${item.status}`).join('|');
}
