import { navHrefPathname } from '~/lib/dashboard-shortcuts/personal-home-url';
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
  return navHrefPathname(path);
}

function resolveTabIconKey(path: string, homePath: string): MobileNavIconKey {
  const target = normalizeNavPath(path);
  const homePathname = normalizeNavPath(homePath);

  if (target === homePathname) {
    return 'home';
  }

  return resolveNavIconKey(path);
}

export function resolveMobileBottomNavTabs(input: {
  homePath: string;
  shortcuts: ResolvedShortcut[];
}): MobileBottomNavTab[] {
  const tabs: MobileBottomNavTab[] = [
    {
      path: input.homePath,
      label: 'Home',
      iconKey: resolveTabIconKey(input.homePath, input.homePath),
    },
  ];

  for (const shortcut of input.shortcuts.slice(0, 3)) {
    tabs.push({
      path: shortcut.href,
      label: shortcut.label,
      iconKey: resolveTabIconKey(shortcut.href, input.homePath),
      avatarUrl: shortcut.avatarUrl,
      avatarColor: shortcut.avatarColor,
      avatarFallback: shortcut.avatarFallback,
    });
  }

  return tabs;
}
