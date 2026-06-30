import { navHrefPathname, normalizeAppHref } from '~/lib/dashboard-shortcuts/personal-home-url';
import type { ResolvedShortcut } from '~/lib/dashboard-shortcuts/types';
import {
  resolveMobileNavIconKey,
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
      iconKey: resolveMobileNavIconKey(href, {
        homePath: input.homePath,
        preferredKey: shortcut.iconKey,
      }),
      avatarUrl: shortcut.avatarUrl,
      avatarColor: shortcut.avatarColor,
      avatarFallback: shortcut.avatarFallback,
    });
  }

  return tabs;
}
