import {
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Kanban,
  LayoutDashboard,
  Mail,
  Settings,
  StickyNote,
  Users,
} from 'lucide-react';
import { z } from 'zod';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import pathsConfig from '~/config/paths.config';
import { getExplicitPersonalHomePath } from '~/lib/dashboard-shortcuts/personal-home-url';

const iconClasses = 'w-4';

export type PersonalNavWorkspace = {
  id: string;
  label: string;
  slug: string;
  pictureUrl: string | null;
  spaceType?: string | null;
};

function navigationShell() {
  return {
    style: process.env.NEXT_PUBLIC_USER_NAVIGATION_STYLE,
    sidebarCollapsed: process.env.NEXT_PUBLIC_HOME_SIDEBAR_COLLAPSED,
    sidebarCollapsedStyle: process.env.NEXT_PUBLIC_SIDEBAR_COLLAPSIBLE_STYLE,
  };
}

/** Personal home sidebar: Home only (workspace shortcuts rendered separately). */
export function buildPersonalHomeNavRoutes() {
  const routes: z.infer<typeof NavigationConfigSchema>['routes'] = [
    {
      label: 'ozer-nav',
      collapsible: false,
      children: [
        {
          label: 'Home',
          path: getExplicitPersonalHomePath(),
          Icon: <LayoutDashboard className={iconClasses} />,
          end: true,
        },
        {
          label: 'Tasks',
          path: `${pathsConfig.app.home}/tasks`,
          Icon: <CheckSquare className={iconClasses} />,
        },
        {
          label: 'Planner',
          path: pathsConfig.app.personalPlanner,
          Icon: <CalendarDays className={iconClasses} />,
        },
        {
          label: 'Email',
          path: pathsConfig.app.personalEmailAssistant,
          Icon: <Mail className={iconClasses} />,
        },
        {
          label: 'Notes',
          path: pathsConfig.app.personalNotes,
          Icon: <StickyNote className={iconClasses} />,
        },
        {
          label: 'People',
          path: pathsConfig.app.personalPeople,
          Icon: <Users className={iconClasses} />,
        },
      ],
    },
  ];

  return routes;
}

export const personalAccountSettingsPath =
  pathsConfig.app.personalAccountSettings;

export { Settings as PersonalSettingsIcon };

export function parsePersonalAccountNavigationConfig(
  routes: z.infer<typeof NavigationConfigSchema>['routes'],
) {
  return NavigationConfigSchema.parse({
    routes,
    ...navigationShell(),
  });
}

/** Layout defaults when routes are not needed. */
export const personalAccountNavigationConfig =
  parsePersonalAccountNavigationConfig(buildPersonalHomeNavRoutes());

export type PersonalShortcutRoute = {
  label: string;
  path: string;
  description?: string;
  keywords?: string[];
};

/**
 * Routes eligible as personal dashboard shortcuts.
 * Sidebar entries are included automatically; add supplements here for
 * personal pages not yet in the sidebar (they appear in the shortcut picker too).
 */
export function buildPersonalShortcutRoutes(): PersonalShortcutRoute[] {
  const fromNav: PersonalShortcutRoute[] = [];

  for (const group of buildPersonalHomeNavRoutes()) {
    for (const child of group.children ?? []) {
      if (!child.path) continue;
      fromNav.push({
        label: child.label,
        path: child.path,
        keywords: [child.label.toLowerCase()],
      });
    }
  }

  const supplements: PersonalShortcutRoute[] = [
    {
      label: 'Tasks',
      path: `${pathsConfig.app.home}/tasks`,
      description: 'All your tasks across personal life and every workspace',
      keywords: ['tasks', 'todo', 'workspaces', 'unified'],
    },
    {
      label: 'Planner',
      path: pathsConfig.app.personalPlanner,
      description: 'AI day planning across personal life and workspaces',
      keywords: ['planner', 'plan', 'schedule', 'today'],
    },
    {
      label: 'Notes',
      path: pathsConfig.app.personalNotes,
      description: 'Personal notes saved as Markdown',
      keywords: ['notes', 'journal', 'writing'],
    },
    {
      label: 'Today',
      path: pathsConfig.app.personalPlannerDay,
      description: 'Minimal today view — schedule and due tasks',
      keywords: ['today', 'day view', 'schedule'],
    },
    {
      label: 'Pipeline',
      path: `${pathsConfig.app.home}/pipeline`,
      keywords: ['pipeline', 'leads'],
    },
    {
      label: 'Email',
      path: pathsConfig.app.personalEmailAssistant,
      description: 'Gmail inbox, suggested to-dos, and AI draft replies',
      keywords: ['email', 'gmail', 'inbox', 'assistant'],
    },
  ];

  const seen = new Set<string>();
  const merged: PersonalShortcutRoute[] = [];

  for (const route of [...fromNav, ...supplements]) {
    if (seen.has(route.path)) continue;
    seen.add(route.path);

    const meta =
      route.path === pathsConfig.app.personalPeople
        ? {
            description: 'Friends, family, and catchups',
            keywords: ['people', 'contacts', 'family', 'friends', 'crm'],
          }
        : {};

    merged.push({ ...route, ...meta });
  }

  return merged;
}

/** Icon links for personal routes used in mobile bottom nav (includes sidebar + supplements). */
export function buildPersonalMobileNavIconLinks(): Array<{
  path: string;
  label: string;
  Icon: React.ReactNode;
}> {
  const icon = (Icon: React.ComponentType<{ className?: string }>) => (
    <Icon className={iconClasses} />
  );

  const fromNav = buildPersonalHomeNavRoutes().flatMap((group) =>
    (group.children ?? []).flatMap((child) =>
      child.path
        ? [{ path: child.path, label: child.label, Icon: child.Icon }]
        : [],
    ),
  );

  const supplements = [
    {
      path: `${pathsConfig.app.home}/tasks`,
      label: 'Tasks',
      Icon: icon(CheckSquare),
    },
    {
      path: pathsConfig.app.personalPlannerDay,
      label: 'Today',
      Icon: icon(CalendarClock),
    },
    {
      path: `${pathsConfig.app.home}/pipeline`,
      label: 'Pipeline',
      Icon: icon(Kanban),
    },
    {
      path: pathsConfig.app.personalEmailAssistant,
      label: 'Email',
      Icon: icon(Mail),
    },
  ];

  const seen = new Set<string>();
  const merged: Array<{ path: string; label: string; Icon: React.ReactNode }> =
    [];

  for (const link of [...fromNav, ...supplements]) {
    if (seen.has(link.path)) continue;
    seen.add(link.path);
    merged.push(link);
  }

  return merged;
}
