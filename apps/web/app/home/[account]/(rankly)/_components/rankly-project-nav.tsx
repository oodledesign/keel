'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@kit/ui/utils';

import {
  isRanklySectionActive,
  RANKLY_PROJECT_SECTIONS,
} from '../_lib/rankly-project-sections';
import { ranklyProjectPaths } from '../_lib/rankly-project-paths';

export function RanklyProjectNav(props: {
  account: string;
  projectId: string;
}) {
  const pathname = usePathname();
  const paths = ranklyProjectPaths(props.account, props.projectId);

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-56">
      <nav
        aria-label="Project sections"
        className="rounded-lg border border-white/10 bg-[var(--workspace-shell-panel)] p-2"
      >
        <ul className="space-y-0.5">
          {RANKLY_PROJECT_SECTIONS.map((section) => {
            const href = paths[section.pathKey];
            const active = isRanklySectionActive(section.id, pathname, href);
            const Icon = section.icon;

            return (
              <li key={section.id}>
                <Link
                  href={href}
                  className={cn(
                    'flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors',
                    active
                      ? 'bg-gradient-to-r from-[var(--keel-gradient-from)] to-[var(--keel-gradient-to)] text-white'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" />
                  {section.navLabel}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
