'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CalendarOff, type LucideIcon } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  isWorkspaceSettingsNavActive,
  type WorkspaceSettingsNavIcon,
  type WorkspaceSettingsNavItem,
} from '../_lib/workspace-settings-nav';

const NAV_ICONS: Record<WorkspaceSettingsNavIcon, LucideIcon> = {
  'calendar-off': CalendarOff,
};

type WorkspaceSettingsSidebarProps = {
  accountSlug: string;
  items: WorkspaceSettingsNavItem[];
};

export function WorkspaceSettingsSidebar({
  accountSlug,
  items,
}: WorkspaceSettingsSidebarProps) {
  const pathname = usePathname();

  if (items.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Workspace settings"
      className="w-full shrink-0 lg:w-52"
    >
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const active = isWorkspaceSettingsNavActive(
            pathname,
            item,
            accountSlug,
          );
          const Icon = item.icon ? NAV_ICONS[item.icon] : null;

          return (
            <li key={item.id} className="shrink-0">
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-[var(--workspace-shell-text-muted)] hover:bg-white/5 hover:text-white',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {Icon ? (
                  <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                ) : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
