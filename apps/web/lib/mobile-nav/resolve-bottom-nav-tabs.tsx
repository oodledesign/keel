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

export type MobileNavLinkPath = {
  path: string;
};

function normalizeNavPath(path: string): string {
  return navHrefPathname(normalizeAppHref(path));
}

/** Prefer the longest matching nav path so deep links inherit the parent module icon. */
function findNavMatch(
  navLinks: MobileNavLinkPath[],
  path: string,
): MobileNavLinkPath | undefined {
  const target = normalizeNavPath(path);

  const exact = navLinks.find(
    (link) => normalizeNavPath(link.path) === target,
  );
  if (exact) return exact;

  let best: MobileNavLinkPath | undefined;
  let bestLength = -1;

  for (const link of navLinks) {
    const linkPath = normalizeNavPath(link.path);
    if (linkPath === '/') continue;

    const isPrefix =
      target === linkPath || target.startsWith(`${linkPath}/`);

    if (isPrefix && linkPath.length > bestLength) {
      best = link;
      bestLength = linkPath.length;
    }
  }

  return best;
}

function resolveTabIconKey(
  path: string,
  homePath: string,
  navLinks: MobileNavLinkPath[] = [],
): MobileNavIconKey {
  const target = normalizeNavPath(path);
  const homePathname = normalizeNavPath(homePath);

  if (target === homePathname) {
    return 'home';
  }

  const match = findNavMatch(navLinks, path);
  if (match) {
    return resolveNavIconKey(match.path);
  }

  return resolveNavIconKey(path);
}

export function resolveMobileBottomNavTabs(input: {
  homePath: string;
  navLinks?: MobileNavLinkPath[];
  shortcuts: ResolvedShortcut[];
}): MobileBottomNavTab[] {
  const navLinks = input.navLinks ?? [];

  const tabs: MobileBottomNavTab[] = [
    {
      path: input.homePath,
      label: 'Home',
      iconKey: resolveTabIconKey(input.homePath, input.homePath, navLinks),
    },
  ];

  for (const shortcut of input.shortcuts.slice(0, 3)) {
    const href = normalizeAppHref(shortcut.href);
    tabs.push({
      path: href,
      label: shortcut.label,
      iconKey: resolveTabIconKey(href, input.homePath, navLinks),
      avatarUrl: shortcut.avatarUrl,
      avatarColor: shortcut.avatarColor,
      avatarFallback: shortcut.avatarFallback,
    });
  }

  return tabs;
}
