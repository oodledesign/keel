export type FolderTreeRow = {
  id: string;
  name: string;
  parent_folder_id: string | null;
};

export type FolderInTree = {
  id: string;
  /** Path relative to the root folder, e.g. "2026 / March"; null for the root. */
  path: string | null;
};

/**
 * The root folder plus every descendant, depth-first with siblings sorted by
 * name. Cycle-safe: each folder appears at most once. Rows outside the root's
 * subtree are ignored, so callers can pass a whole account's folders.
 */
export function flattenFolderTree(
  rootId: string,
  rows: FolderTreeRow[],
): FolderInTree[] {
  const childrenByParent = new Map<string, FolderTreeRow[]>();
  for (const row of rows) {
    if (!row.parent_folder_id) continue;
    const siblings = childrenByParent.get(row.parent_folder_id) ?? [];
    siblings.push(row);
    childrenByParent.set(row.parent_folder_id, siblings);
  }

  const result: FolderInTree[] = [{ id: rootId, path: null }];
  const visited = new Set<string>([rootId]);

  const walk = (parentId: string, parentPath: string | null) => {
    const children = [...(childrenByParent.get(parentId) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      const path = parentPath ? `${parentPath} / ${child.name}` : child.name;
      result.push({ id: child.id, path });
      walk(child.id, path);
    }
  };
  walk(rootId, null);

  return result;
}
