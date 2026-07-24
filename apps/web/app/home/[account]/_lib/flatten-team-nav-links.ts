import type { z } from 'zod';

import type { NavigationConfigSchema } from '@kit/ui/navigation-schema';

type NavConfig = z.infer<typeof NavigationConfigSchema>;

export type MobileNavLink = {
  path: string;
  label: string;
  Icon: React.ReactNode;
};

export type MobileNavSection = {
  /** Null when the desktop group label is hidden (e.g. `ozer-nav*`). */
  sectionLabel: string | null;
  links: MobileNavLink[];
};

function flattenGroupChildren(
  children: NavConfig['routes'][number] extends { children: infer C }
    ? C
    : never,
): MobileNavLink[] {
  const links: MobileNavLink[] = [];

  for (const child of children as Array<{
    path?: string;
    label: string;
    Icon: React.ReactNode;
    collapsible?: boolean;
    children?: Array<{
      path: string;
      label: string;
      Icon: React.ReactNode;
    }>;
  }>) {
    if ('collapsible' in child && child.collapsible && child.children?.length) {
      if (child.path) {
        links.push({
          path: child.path,
          label: child.label,
          Icon: child.Icon,
        });
      }

      for (const nested of child.children) {
        links.push({
          path: nested.path,
          label: nested.label,
          Icon: nested.Icon,
        });
      }
      continue;
    }

    if (!child.path) {
      continue;
    }

    links.push({
      path: child.path,
      label: child.label,
      Icon: child.Icon,
    });
  }

  return links;
}

/** Flat list for callers that do not need section headers. */
export function flattenTeamNavLinks(config: NavConfig): MobileNavLink[] {
  return flattenTeamNavSections(config).flatMap((section) => section.links);
}

/**
 * Preserves desktop sidebar section labels for the mobile menu.
 * Labels starting with `ozer-nav` are treated as unlabeled (same as sidebar).
 */
export function flattenTeamNavSections(config: NavConfig): MobileNavSection[] {
  const sections: MobileNavSection[] = [];

  for (const group of config.routes) {
    if (!('children' in group)) {
      continue;
    }

    const links = flattenGroupChildren(group.children);

    if (links.length === 0) {
      continue;
    }

    const rawLabel = typeof group.label === 'string' ? group.label.trim() : '';
    const sectionLabel =
      !rawLabel || rawLabel.startsWith('ozer-nav') ? null : rawLabel;

    sections.push({ sectionLabel, links });
  }

  return sections;
}
