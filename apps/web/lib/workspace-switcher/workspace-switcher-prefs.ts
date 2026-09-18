export type WorkspaceSwitcherPrefs = {
  /** Workspace ids in display order. Unknown ids are ignored; new ones append. */
  order: string[];
  /** When true, the workspace selector shows a search/filter field. */
  showSearch: boolean;
};

const STORAGE_PREFIX = 'ozer-workspace-switcher-prefs:';

const prefListeners = new Set<() => void>();

function onStorage(event: StorageEvent) {
  if (event.key?.startsWith(STORAGE_PREFIX)) {
    emitWorkspaceSwitcherPrefs();
  }
}

export function subscribeWorkspaceSwitcherPrefs(listener: () => void) {
  prefListeners.add(listener);
  if (
    prefListeners.size === 1 &&
    typeof window !== 'undefined' &&
    typeof window.addEventListener === 'function'
  ) {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    prefListeners.delete(listener);
    if (
      prefListeners.size === 0 &&
      typeof window !== 'undefined' &&
      typeof window.removeEventListener === 'function'
    ) {
      window.removeEventListener('storage', onStorage);
    }
  };
}

export function emitWorkspaceSwitcherPrefs() {
  for (const listener of prefListeners) listener();
}

export function workspaceSwitcherPrefsKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function getWorkspaceSwitcherPrefsSnapshot(userId: string): string {
  if (typeof window === 'undefined' || !userId) {
    return '';
  }

  try {
    return window.localStorage.getItem(workspaceSwitcherPrefsKey(userId)) ?? '';
  } catch {
    return '';
  }
}

export function parseWorkspaceSwitcherPrefs(
  raw: string | null | undefined,
): WorkspaceSwitcherPrefs {
  if (!raw) {
    return { order: [], showSearch: false };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return { order: [], showSearch: false };
    }

    const record = parsed as Record<string, unknown>;
    const order = Array.isArray(record.order)
      ? record.order.filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        )
      : [];
    const uniqueOrder = [...new Set(order)];

    return {
      order: uniqueOrder,
      showSearch: record.showSearch === true,
    };
  } catch {
    return { order: [], showSearch: false };
  }
}

export function readWorkspaceSwitcherPrefs(
  userId: string,
): WorkspaceSwitcherPrefs {
  if (typeof window === 'undefined' || !userId) {
    return { order: [], showSearch: false };
  }

  try {
    return parseWorkspaceSwitcherPrefs(
      window.localStorage.getItem(workspaceSwitcherPrefsKey(userId)),
    );
  } catch {
    return { order: [], showSearch: false };
  }
}

export function writeWorkspaceSwitcherPrefs(
  userId: string,
  prefs: WorkspaceSwitcherPrefs,
): void {
  if (typeof window === 'undefined' || !userId) {
    return;
  }

  try {
    window.localStorage.setItem(
      workspaceSwitcherPrefsKey(userId),
      JSON.stringify({
        order: [...new Set(prefs.order.filter((id) => id.length > 0))],
        showSearch: prefs.showSearch === true,
      }),
    );
    emitWorkspaceSwitcherPrefs();
  } catch {
    // Ignore quota / private-mode failures; in-session state still applies.
  }
}

export function applyWorkspaceOrder<T extends { id: string }>(
  accounts: T[],
  order: string[],
): T[] {
  if (order.length === 0 || accounts.length < 2) {
    return accounts;
  }

  const index = new Map(order.map((id, i) => [id, i]));
  return [...accounts].sort((a, b) => {
    const ai = index.get(a.id);
    const bi = index.get(b.id);
    if (ai == null && bi == null) return 0;
    if (ai == null) return 1;
    if (bi == null) return -1;
    return ai - bi;
  });
}

export function moveWorkspaceInOrder(
  ids: string[],
  id: string,
  direction: -1 | 1,
): string[] {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) {
    return ids;
  }

  const next = [...ids];
  const [item] = next.splice(from, 1);
  if (!item) {
    return ids;
  }
  next.splice(to, 0, item);
  return next;
}
