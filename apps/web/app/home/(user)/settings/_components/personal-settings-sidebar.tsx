'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@kit/ui/utils';

import {
  isPersonalSettingsNavActive,
  type PersonalSettingsNavItem,
} from '../_lib/personal-settings-nav';

type PersonalSettingsSidebarProps = {
  items: PersonalSettingsNavItem[];
};

export function PersonalSettingsSidebar({ items }: PersonalSettingsSidebarProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Personal settings" className="w-full shrink-0 lg:w-52">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const active = isPersonalSettingsNavActive(pathname, item);

          return (
            <li key={item.id} className="shrink-0">
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
