import 'server-only';

import type { ShortcutCatalogItem, ResolvedShortcut, StoredShortcut } from './types';
import { catalogItemKey } from './types';
import { catalogItemHref, resolveShortcutHref } from './resolve-href';

export function resolveStoredShortcuts(
  stored: StoredShortcut[],
  catalog: ShortcutCatalogItem[],
): ResolvedShortcut[] {
  const catalogMap = new Map(
    catalog.map((item) => [catalogItemKey(item), item]),
  );

  const resolved: ResolvedShortcut[] = [];

  for (const row of stored) {
    const key = catalogItemKey({ catalogId: row.catalogId, params: row.params });
    const match = catalogMap.get(key);
    const href =
      resolveShortcutHref(row.catalogId, row.params) ??
      (match ? catalogItemHref(match) : null);

    if (!href) continue;

    resolved.push({
      id: row.id,
      label: row.label?.trim() || match?.label || 'Shortcut',
      href,
      description: match?.description,
    });
  }

  return resolved;
}
