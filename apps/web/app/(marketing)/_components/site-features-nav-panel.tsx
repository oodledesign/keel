'use client';

import { useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn, isRouteActive } from '@kit/ui/utils';

import { FEATURE_NAV_GROUPS } from '~/lib/marketing/feature-landing-pages';

import {
  marketingNavPanelClass,
  marketingNavScrollClass,
} from './site-marketing-nav-styles';

export function SiteFeaturesNavPanel() {
  const pathname = usePathname();
  const [activeGroup, setActiveGroup] = useState(
    FEATURE_NAV_GROUPS[0]?.label ?? 'Work',
  );

  const activeItems =
    FEATURE_NAV_GROUPS.find((group) => group.label === activeGroup)?.items ??
    [];

  return (
    <div
      className={cn(
        'grid w-[min(100vw-2rem,28rem)] gap-2 p-2',
        marketingNavPanelClass,
        marketingNavScrollClass,
      )}
    >
      <Link
        href="/features"
        className="block rounded-lg px-3 py-2.5 text-sm font-medium text-violet-50 transition hover:bg-violet-500/15"
      >
        All features
        <span className="mt-0.5 block text-xs font-normal text-violet-200/70">
          One connected system for your agency
        </span>
      </Link>

      <div className="flex min-h-[11rem] border-t border-[color:var(--workspace-shell-border)] pt-2">
        <div
          className="w-[7.25rem] shrink-0 space-y-0.5 border-r border-[color:var(--workspace-shell-border)] pr-1"
          role="tablist"
          aria-label="Feature categories"
        >
          {FEATURE_NAV_GROUPS.map((group) => {
            const selected = activeGroup === group.label;

            return (
              <button
                key={group.label}
                type="button"
                role="tab"
                aria-selected={selected}
                onMouseEnter={() => setActiveGroup(group.label)}
                onFocus={() => setActiveGroup(group.label)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-violet-100/80 transition hover:bg-violet-500/10 hover:text-violet-50',
                  selected && 'bg-violet-500/15 text-violet-50',
                )}
              >
                {group.label}
              </button>
            );
          })}
        </div>

        <div
          className="min-w-0 flex-1 space-y-0.5 pl-1"
          role="tabpanel"
          aria-label={`${activeGroup} features`}
        >
          {activeItems.map((item) => {
            const itemActive = isRouteActive(item.href, pathname, false);

            return (
              <Link
                key={`${activeGroup}-${item.href}-${item.label}`}
                href={item.href}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm text-violet-100/85 transition hover:bg-violet-500/15 hover:text-violet-50',
                  itemActive && 'bg-violet-500/10 text-violet-50',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
