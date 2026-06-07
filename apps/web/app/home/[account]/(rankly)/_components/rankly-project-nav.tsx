'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  FileText,
  Gauge,
  Globe2,
  LayoutDashboard,
  Network,
  Search,
  Sparkles,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { ranklyProjectPaths } from '../_lib/rankly-project-paths';

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  isActive: (pathname: string, href: string, paths: ReturnType<typeof ranklyProjectPaths>) => boolean;
};

function buildNavItems(
  paths: ReturnType<typeof ranklyProjectPaths>,
): NavItem[] {
  return [
    {
      label: 'Dashboard',
      href: paths.dashboard,
      icon: LayoutDashboard,
      isActive: (pathname, href) => pathname === href,
    },
    {
      label: 'Keyword tracking',
      href: paths.keywords,
      icon: Search,
      isActive: (pathname, href) => pathname.startsWith(href),
    },
    {
      label: 'Site Explorer',
      href: paths.siteExplorer,
      icon: Globe2,
      isActive: (pathname, href) => pathname.startsWith(href),
    },
    {
      label: 'PageSpeed',
      href: paths.pagespeed,
      icon: Gauge,
      isActive: (pathname, href) => pathname.startsWith(href),
    },
    {
      label: 'AI Search Audit',
      href: paths.aiAudit,
      icon: Sparkles,
      isActive: (pathname, href) => pathname.startsWith(href),
    },
    {
      label: 'Content briefs',
      href: paths.briefs,
      icon: FileText,
      isActive: (pathname, href) => pathname.startsWith(href),
    },
    {
      label: 'Keyword clusters',
      href: paths.clusters,
      icon: Network,
      isActive: (pathname, href) => pathname.startsWith(href),
    },
  ];
}

export function RanklyProjectNav(props: {
  account: string;
  projectId: string;
}) {
  const pathname = usePathname();
  const paths = ranklyProjectPaths(props.account, props.projectId);
  const items = buildNavItems(paths);

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-56">
      <nav
        aria-label="Project sections"
        className="rounded-lg border border-white/10 bg-[var(--workspace-shell-panel)] p-2"
      >
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = item.isActive(pathname, item.href, paths);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors',
                    active
                      ? 'bg-gradient-to-r from-[var(--keel-gradient-from)] to-[var(--keel-gradient-to)] text-white'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
