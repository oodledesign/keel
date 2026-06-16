import {
  BarChart3,
  Briefcase,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileSignature,
  FileText,
  Globe,
  Kanban,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  ListChecks,
  Mail,
  MessageSquare,
  MessageSquareText,
  PenLine,
  Share2,
  Sparkles,
  StickyNote,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import type { MobileNavLink } from '~/components/workspace-shell/workspace-mobile-nav';
import pathsConfig from '~/config/paths.config';
import { navHrefPathname } from '~/lib/dashboard-shortcuts/personal-home-url';
import type { ResolvedShortcut } from '~/lib/dashboard-shortcuts/types';

const MOBILE_NAV_ICON_CLASS = 'h-5 w-5';

export type MobileBottomNavTab = {
  path: string;
  label: string;
  Icon: React.ReactNode;
};

function normalizeNavPath(path: string): string {
  return navHrefPathname(path);
}

function iconNode(Icon: LucideIcon) {
  return <Icon className={MOBILE_NAV_ICON_CLASS} />;
}

/** Fallback icons for personal routes and workspace modules (by URL segment). */
const PERSONAL_SEGMENT_ICONS: Record<string, LucideIcon> = {
  tasks: CheckSquare,
  pipeline: Kanban,
  email: Mail,
  planner: CalendarDays,
  people: Users,
  settings: Users,
};

const WORKSPACE_SEGMENT_ICONS: Record<string, LucideIcon> = {
  jobs: ClipboardList,
  tasks: CheckSquare,
  planner: Sparkles,
  schedule: Calendar,
  pipeline: Kanban,
  clients: Briefcase,
  meetings: Mic,
  websites: Globe,
  support: LifeBuoy,
  invoices: FileText,
  proposals: PenLine,
  contracts: FileSignature,
  people: Users,
  notes: StickyNote,
  brain: Sparkles,
  sops: ListChecks,
  messages: MessageSquare,
  finances: Wallet,
  videos: LayoutGrid,
  rankly: BarChart3,
  signatures: PenLine,
  feedflow: Share2,
  reviews: MessageSquareText,
  social: Share2,
  apps: LayoutGrid,
  properties: Briefcase,
  calendar: Calendar,
  shopping: LayoutGrid,
  meal: CalendarDays,
};

function iconFromHrefFallback(href: string): React.ReactNode | null {
  const normalized = normalizeNavPath(href);
  const parts = normalized.split('/').filter(Boolean);

  if (parts[0] !== 'app') return null;

  if (parts.length === 1 || (parts.length === 2 && parts[1] === 'home')) {
    return iconNode(LayoutDashboard);
  }

  if (parts.length === 2) {
    const personal = PERSONAL_SEGMENT_ICONS[parts[1]!];
    if (personal) return iconNode(personal);
  }

  if (parts.length >= 3) {
    const moduleKey = parts[2]!.split('?')[0]!;
    const workspace = WORKSPACE_SEGMENT_ICONS[moduleKey];
    if (workspace) return iconNode(workspace);
  }

  if (normalized === normalizeNavPath(pathsConfig.app.personalPlannerDay)) {
    return iconNode(CalendarClock);
  }

  if (normalized === normalizeNavPath(pathsConfig.app.personalEmailAssistant)) {
    return iconNode(Mail);
  }

  return null;
}

/** Prefer the longest matching nav path so `/app/oodle/jobs` maps to Jobs, not Dashboard. */
function findNavPrefixMatch(navLinks: MobileNavLink[], path: string) {
  const target = normalizeNavPath(path);

  let best: MobileNavLink | undefined;
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

function resolveTabIcon(
  path: string,
  navLinks: MobileNavLink[],
  fallback: LucideIcon,
) {
  const target = normalizeNavPath(path);

  const exact = navLinks.find(
    (link) => normalizeNavPath(link.path) === target,
  );
  if (exact?.Icon) return exact.Icon;

  const hrefFallback = iconFromHrefFallback(path);
  if (hrefFallback) return hrefFallback;

  const prefix = findNavPrefixMatch(navLinks, path);
  if (prefix?.Icon) return prefix.Icon;

  return iconNode(fallback);
}

export function resolveMobileBottomNavTabs(input: {
  homePath: string;
  navLinks: MobileNavLink[];
  shortcuts: ResolvedShortcut[];
}): MobileBottomNavTab[] {
  const tabs: MobileBottomNavTab[] = [
    {
      path: input.homePath,
      label: 'Home',
      Icon: resolveTabIcon(input.homePath, input.navLinks, LayoutDashboard),
    },
  ];

  for (const shortcut of input.shortcuts.slice(0, 3)) {
    tabs.push({
      path: shortcut.href,
      label: shortcut.label,
      Icon: resolveTabIcon(shortcut.href, input.navLinks, LayoutDashboard),
    });
  }

  return tabs;
}
