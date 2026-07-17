import 'server-only';

import {
  type MobileNavIconKey,
  coerceMobileNavIconKey,
  resolveNavIconKey,
} from '~/lib/mobile-nav/nav-icon-keys';

import { normalizeAppHref } from './personal-home-url';
import { catalogItemHref, resolveShortcutHref } from './resolve-href';
import type {
  ResolvedShortcut,
  ShortcutCatalogItem,
  StoredShortcut,
} from './types';
import { catalogItemKey } from './types';

const LEGACY_MODULE_ICON_KEYS: Record<string, MobileNavIconKey> = {
  projects: 'jobs',
  tasks: 'tasks',
  schedule: 'schedule',
  pipeline: 'pipeline',
  clients: 'clients',
  meetings: 'meetings',
  websites: 'websites',
  support_tickets: 'support',
  invoices: 'invoices',
  proposals: 'proposals',
  contracts: 'contracts',
  team: 'people',
  notes: 'notes',
  finances: 'finances',
  videos: 'videos',
  properties: 'properties',
  tenants: 'clients',
  maintenance: 'jobs',
  calendar: 'calendar',
  shopping: 'shopping',
  meal_plan: 'meal',
  community_schedule: 'calendar',
  community_tasks: 'tasks',
  community_notes: 'notes',
  rankly: 'rankly',
  signatures: 'signatures',
  reviews: 'reviews',
  social: 'social',
};

function resolveStoredIconKey(
  row: StoredShortcut,
  normalizedHref: string,
): MobileNavIconKey {
  const fromPath = resolveNavIconKey(normalizedHref);
  if (fromPath !== 'workspace') {
    return fromPath;
  }

  const stored = coerceMobileNavIconKey(row.iconKey);
  if (stored) {
    return stored;
  }

  if (row.catalogId === 'workspace.module') {
    const moduleKey = row.params.module?.trim();
    if (moduleKey && LEGACY_MODULE_ICON_KEYS[moduleKey]) {
      return LEGACY_MODULE_ICON_KEYS[moduleKey]!;
    }
  }

  return fromPath;
}

export function resolveStoredShortcuts(
  stored: StoredShortcut[],
  catalog: ShortcutCatalogItem[],
): ResolvedShortcut[] {
  const catalogMap = new Map(
    catalog.map((item) => [catalogItemKey(item), item]),
  );

  const resolved: ResolvedShortcut[] = [];

  for (const row of stored) {
    const key = catalogItemKey({
      catalogId: row.catalogId,
      params: row.params,
    });
    const match = catalogMap.get(key);
    const href =
      resolveShortcutHref(row.catalogId, row.params) ??
      (match ? catalogItemHref(match) : null);

    if (!href) continue;

    const normalizedHref = normalizeAppHref(href);

    resolved.push({
      id: row.id,
      label: row.label?.trim() || match?.label || 'Shortcut',
      href: normalizedHref,
      description: match?.description,
      iconKey: resolveStoredIconKey(row, normalizedHref),
    });
  }

  return resolved;
}
