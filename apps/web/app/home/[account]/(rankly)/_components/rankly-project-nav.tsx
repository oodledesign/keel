'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import {
  isRanklySectionActive,
  RANKLY_PROJECT_SECTIONS,
} from '../_lib/rankly-project-sections';
import { ranklyProjectPaths } from '../_lib/rankly-project-paths';

const STORAGE_KEY = 'rankly-project-nav-collapsed';

function NavLink(props: {
  href: string;
  active: boolean;
  collapsed: boolean;
  label: string;
  icon: ReactNode;
}) {
  const link = (
    <Link
      href={props.href}
      className={cn(
        'flex h-10 items-center rounded-md text-sm font-medium transition-colors',
        props.collapsed
          ? 'justify-center px-0 max-lg:h-9 max-lg:w-9 lg:justify-center lg:px-0'
          : 'gap-2.5 px-3',
        props.active
          ? 'ozer-gradient-active'
          : 'text-muted-foreground hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
      )}
    >
      {props.icon}
      {!props.collapsed ? <span className="truncate">{props.label}</span> : null}
    </Link>
  );

  if (!props.collapsed) {
    return link;
  }

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="max-lg:hidden">
        {props.label}
      </TooltipContent>
    </Tooltip>
  );
}

export function RanklyProjectNav(props: {
  account: string;
  projectId: string;
}) {
  const pathname = usePathname();
  const paths = ranklyProjectPaths(props.account, props.projectId);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true');
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  return (
    <aside
      className={cn(
        'w-full shrink-0 transition-[width] duration-200 lg:sticky lg:top-6',
        collapsed ? 'lg:w-12' : 'lg:w-56',
      )}
    >
      <TooltipProvider>
        <nav
          aria-label="Project sections"
          className={cn(
            'rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-2',
            collapsed && 'max-lg:px-1.5 max-lg:py-2',
          )}
        >
          <div
            className={cn(
              'mb-1 flex',
              collapsed ? 'max-lg:mb-2 max-lg:justify-end lg:justify-center' : 'justify-end',
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-[var(--workspace-shell-text)]"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand project navigation' : 'Collapse project navigation'}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>

          <ul
            className={cn(
              collapsed
                ? 'flex flex-wrap items-center justify-center gap-1 max-lg:flex-row lg:block lg:space-y-0.5'
                : 'space-y-0.5',
            )}
          >
            {RANKLY_PROJECT_SECTIONS.map((section) => {
              const href = paths[section.pathKey];
              const active = isRanklySectionActive(section.id, pathname, href);
              const Icon = section.icon;

              return (
                <li key={section.id}>
                  <NavLink
                    href={href}
                    active={active}
                    collapsed={collapsed}
                    label={section.navLabel}
                    icon={<Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />}
                  />
                </li>
              );
            })}
          </ul>
        </nav>
      </TooltipProvider>
    </aside>
  );
}
