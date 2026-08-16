import type { z } from 'zod';

import type { NavigationConfigSchema } from '@kit/ui/navigation-schema';

type NavConfig = z.infer<typeof NavigationConfigSchema>;
type NavLink = {
  path: string;
  label: string;
  Icon: React.ReactNode;
  tourId?: string;
};

export function flattenPersonalNavLinks(config: NavConfig): NavLink[] {
  const links: NavLink[] = [];

  for (const group of config.routes) {
    if (!('children' in group)) {
      continue;
    }

    for (const child of group.children) {
      if (
        'collapsible' in child &&
        child.collapsible &&
        child.children?.length
      ) {
        for (const nested of child.children) {
          links.push({
            path: nested.path,
            label: nested.label,
            Icon: nested.Icon,
            tourId: 'tourId' in nested ? nested.tourId : undefined,
          });
        }
        continue;
      }

      links.push({
        path: child.path,
        label: child.label,
        Icon: child.Icon,
        tourId: 'tourId' in child ? child.tourId : undefined,
      });
    }
  }

  return links;
}
