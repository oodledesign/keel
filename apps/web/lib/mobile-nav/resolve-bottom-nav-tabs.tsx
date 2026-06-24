import { navHrefPathname, normalizeAppHref } from '~/lib/dashboard-shortcuts/personal-home-url';
import type { ResolvedShortcut } from '~/lib/dashboard-shortcuts/types';
import {
  resolveNavIconKey,
  type MobileNavIconKey,
} from '~/lib/mobile-nav/nav-icon-keys';

export type MobileBottomNavTab = {
  path: string;
  label: string;
  iconKey: MobileNavIconKey;
  avatarUrl?: string | null;
  avatarColor?: string;
  avatarFallback?: string;
};

function normalizeNavPath(path: string): string {
  return navHrefPathname(normalizeAppHref(path));
}

function coerceIconKey(value: string | undefined): MobileNavIconKey | null {
  if (!value) return null;
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
  return allowed.includes(value as MobileNavIconKey)
    ? (value as MobileNavIconKey)
    : null;
}

function resolveTabIconKey(
  path: string,
  homePath: string,
  preferredKey?: string,
): MobileNavIconKey {
  const fromPreferred = coerceIconKey(preferredKey);
  if (fromPreferred && fromPreferred !== 'workspace') {
    return fromPreferred;
  }

  const target = normalizeNavPath(path);
  const homePathname = normalizeNavPath(homePath);

  if (target === homePathname) {
    return 'home';
  }

  const fromPath = resolveNavIconKey(path);
  if (fromPath !== 'workspace') {
    return fromPath;
  }

  return fromPreferred ?? fromPath;
}

export function resolveMobileBottomNavTabs(input: {
  homePath: string;
  shortcuts: ResolvedShortcut[];
}): MobileBottomNavTab[] {
  const tabs: MobileBottomNavTab[] = [
    {
      path: input.homePath,
      label: 'Home',
      iconKey: 'home',
    },
  ];

  for (const shortcut of input.shortcuts.slice(0, 3)) {
    const href = normalizeAppHref(shortcut.href);
    tabs.push({
      path: href,
      label: shortcut.label,
      iconKey: resolveTabIconKey(href, input.homePath, shortcut.iconKey),
      avatarUrl: shortcut.avatarUrl,
      avatarColor: shortcut.avatarColor,
      avatarFallback: shortcut.avatarFallback,
    });
  }

  return tabs;
}
