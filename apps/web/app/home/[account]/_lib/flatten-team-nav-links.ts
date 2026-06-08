import type { NavigationConfigSchema } from '@kit/ui/navigation-schema';
import type { z } from 'zod';

type NavConfig = z.infer<typeof NavigationConfigSchema>;
type NavLink = {
  path: string;
  label: string;
  Icon: React.ReactNode;
};

export function flattenTeamNavLinks(config: NavConfig): NavLink[] {
  const links: NavLink[] = [];

  for (const group of config.routes) {
    if (!('children' in group)) {
      continue;
    }

    for (const child of group.children) {
      if ('collapsible' in child && child.collapsible && child.children?.length) {
        links.push({
          path: child.path,
          label: child.label,
          Icon: child.Icon,
        });
        continue;
      }

      links.push({
        path: child.path,
        label: child.label,
        Icon: child.Icon,
      });
    }
  }

  return links;
}
