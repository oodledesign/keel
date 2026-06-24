import 'server-only';

import type { ShortcutCatalogItem, ResolvedShortcut, StoredShortcut } from './types';
import { catalogItemKey } from './types';
import { catalogItemHref, resolveShortcutHref } from './resolve-href';
import { normalizeAppHref } from './personal-home-url';
import { resolveNavIconKey, type MobileNavIconKey } from '~/lib/mobile-nav/nav-icon-keys';

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

function coerceStoredIconKey(value: string | undefined): MobileNavIconKey | null {
  if (!value?.trim()) return null;

  const key = value.trim() as MobileNavIconKey;
  const allowed: MobileNavIconKey[] = [
    'home',
    'tasks',
    'pipeline',
    'email',
    'planner',
    'today',
    'people',
    'jobs',
    'schedule',
    'clients',
    'meetings',
    'websites',
    'support',
    'invoices',
    'proposals',
    'contracts',
    'notes',
    'brain',
    'sops',
    'messages',
    'finances',
    'videos',
    'rankly',
    'signatures',
    'feedflow',
    'reviews',
    'social',
    'apps',
    'properties',
    'calendar',
    'shopping',
    'meal',
    'workspace',
  ];

  return allowed.includes(key) ? key : null;
}

function resolveStoredIconKey(
  row: StoredShortcut,
  normalizedHref: string,
): MobileNavIconKey {
  const stored = coerceStoredIconKey(row.iconKey);
  if (stored) return stored;

  if (row.catalogId === 'workspace.module') {
    const moduleKey = row.params.module?.trim();
    if (moduleKey && LEGACY_MODULE_ICON_KEYS[moduleKey]) {
      return LEGACY_MODULE_ICON_KEYS[moduleKey]!;
    }
  }

  return resolveNavIconKey(normalizedHref);
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
    const key = catalogItemKey({ catalogId: row.catalogId, params: row.params });
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
