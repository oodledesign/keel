export type SessionStatusNode = {
  id: string;
  status: string;
  parentTaskId?: string | null;
  subtasks?: SessionStatusNode[] | null;
};

export function isTaskDoneStatus(status: string | null | undefined): boolean {
  const value = (status ?? '').toLowerCase();
  return value === 'completed' || value === 'done';
}

/** Drop rows the user already accepted or dismissed in this mounted session. */
export function omitHiddenItems<T extends { id: string }>(
  items: readonly T[],
  hiddenIds: ReadonlySet<string>,
): T[] {
  if (hiddenIds.size === 0) return items as T[];
  return items.filter((item) => !hiddenIds.has(item.id));
}

/**
 * Overlay this session's status edits onto a fresh server list.
 * Tasks the server dropped (open-only queries) stay in place until unmount.
 */
export function applySessionTaskStatuses<T extends SessionStatusNode>(
  serverNodes: readonly T[],
  session: ReadonlyMap<string, string>,
  previous: readonly T[] = [],
): T[] {
  const previousById = new Map<string, T>();
  const index = (nodes: readonly T[]) => {
    for (const node of nodes) {
      previousById.set(node.id, node);
      if (node.subtasks?.length) {
        index(node.subtasks as T[]);
      }
    }
  };
  index(previous);

  const seen = new Set<string>();

  const mapNode = (node: T): T => {
    seen.add(node.id);
    const status = (session.get(node.id) ?? node.status) as T['status'];
    const subtasks = node.subtasks?.length
      ? (node.subtasks as T[]).map(mapNode)
      : node.subtasks;
    if (status === node.status && subtasks === node.subtasks) {
      return node;
    }
    return { ...node, status, subtasks };
  };

  const merged = serverNodes.map(mapNode);

  if (session.size === 0) return merged;

  const missing: T[] = [];
  for (const [id, status] of session) {
    if (seen.has(id)) continue;
    const prior = previousById.get(id);
    if (!prior) continue;
    missing.push({
      ...prior,
      status: status as T['status'],
      subtasks: prior.subtasks,
    });
  }

  if (missing.length === 0) return merged;

  const missingIds = new Set(missing.map((node) => node.id));
  for (const node of missing) {
    const parentId = node.parentTaskId;
    if (parentId && missingIds.has(parentId)) continue;
    if (!insertUnderParent(merged, node)) {
      merged.push(node);
    }
  }

  return merged;
}

function insertUnderParent<T extends SessionStatusNode>(
  nodes: T[],
  node: T,
): boolean {
  const parentId = node.parentTaskId;
  if (!parentId) return false;

  for (let index = 0; index < nodes.length; index += 1) {
    const current = nodes[index]!;
    if (current.id === parentId) {
      const subtasks = [...((current.subtasks as T[] | undefined) ?? []), node];
      nodes[index] = { ...current, subtasks };
      return true;
    }
    if (current.subtasks?.length) {
      const subtasks = [...(current.subtasks as T[])];
      if (insertUnderParent(subtasks, node)) {
        nodes[index] = { ...current, subtasks };
        return true;
      }
    }
  }

  return false;
}
