'use client';

import { useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn, isRouteActive } from '@kit/ui/utils';

import { FEATURE_NAV_GROUPS } from '~/lib/marketing/feature-landing-pages';
import {
  marketingNavDropdownDesc,
  marketingNavDropdownItem,
  marketingNavDropdownTitle,
  marketingNavLink,
  marketingNavLinkActive,
} from '~/lib/marketing/marketing-ui';

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
      <Link href="/features" className={cn(marketingNavDropdownItem, 'block')}>
        <span className={marketingNavDropdownTitle}>All features</span>
        <span className={marketingNavDropdownDesc}>
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
                  marketingNavLink,
                  'w-full justify-between px-2.5 py-2 text-xs font-semibold',
                  selected && marketingNavLinkActive,
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
                  marketingNavLink,
                  'block rounded-lg px-3 py-2 text-sm',
                  itemActive && marketingNavLinkActive,
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
