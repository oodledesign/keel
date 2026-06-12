import { LayoutDashboard, Link2 } from 'lucide-react';

import type { MobileNavLink } from '~/components/workspace-shell/workspace-mobile-nav';
import type { ResolvedShortcut } from '~/lib/dashboard-shortcuts/types';

export type MobileBottomNavTab = {
  path: string;
  label: string;
  Icon: React.ReactNode;
};

function findNavMatch(navLinks: MobileNavLink[], path: string) {
  const exact = navLinks.find((link) => link.path === path);
  if (exact) return exact;

  return navLinks.find(
    (link) =>
      path.startsWith(`${link.path}/`) ||
      (link.path !== '/' && link.path.startsWith(`${path}/`)),
  );
}

export function resolveMobileBottomNavTabs(input: {
  homePath: string;
  navLinks: MobileNavLink[];
  shortcuts: ResolvedShortcut[];
}): MobileBottomNavTab[] {
  const homeMatch = findNavMatch(input.navLinks, input.homePath);

  const tabs: MobileBottomNavTab[] = [
    {
      path: input.homePath,
      label: 'Home',
      Icon: homeMatch?.Icon ?? <LayoutDashboard className="h-5 w-5" />,
    },
  ];

  for (const shortcut of input.shortcuts.slice(0, 3)) {
    const match = findNavMatch(input.navLinks, shortcut.href);
    tabs.push({
      path: shortcut.href,
      label: shortcut.label,
      Icon: match?.Icon ?? <Link2 className="h-5 w-5" />,
    });
  }

  return tabs;
}
