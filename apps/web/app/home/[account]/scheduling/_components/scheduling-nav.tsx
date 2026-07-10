'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Bell,
  CalendarClock,
  CalendarRange,
  Link2,
  Plug,
} from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@kit/ui/tabs';

import pathsConfig from '~/config/paths.config';

const items = [
  {
    label: 'Booking pages',
    icon: Link2,
    href: pathsConfig.app.accountScheduling,
    match: '/scheduling',
    exact: true,
  },
  {
    label: 'Availability',
    icon: CalendarRange,
    href: pathsConfig.app.accountSchedulingAvailability,
    match: '/scheduling/availability',
  },
  {
    label: 'Bookings',
    icon: CalendarClock,
    href: pathsConfig.app.accountSchedulingBookings,
    match: '/scheduling/bookings',
  },
  {
    label: 'Notifications',
    icon: Bell,
    href: pathsConfig.app.accountSchedulingNotifications,
    match: '/scheduling/notifications',
  },
  {
    label: 'Connected accounts',
    icon: Plug,
    href: pathsConfig.app.accountSchedulingAccounts,
    match: '/scheduling/accounts',
  },
];

export function SchedulingNav({ accountSlug }: { accountSlug: string }) {
  const pathname = usePathname();

  const active =
    items
      .filter((item) => {
        if (item.exact) {
          return (
            pathname.endsWith('/scheduling') ||
            pathname.includes('/scheduling/pages/')
          );
        }
        return pathname.includes(item.match);
      })
      .sort((a, b) => b.match.length - a.match.length)[0]?.label ??
    'Booking pages';

  return (
    <Tabs value={active} className="w-full">
      <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-1">
        {items.map((item) => {
          const Icon = item.icon;
          const href = item.href.replace('[account]', accountSlug);

          return (
            <TabsTrigger
              key={item.label}
              value={item.label}
              asChild
              className="gap-2 rounded-full text-[var(--workspace-shell-text-muted)] data-[state=active]:border data-[state=active]:border-[var(--ozer-accent)]/30 data-[state=active]:bg-[var(--workspace-shell-panel)] data-[state=active]:text-[var(--workspace-shell-text)] data-[state=active]:shadow-none"
            >
              <Link href={href}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
