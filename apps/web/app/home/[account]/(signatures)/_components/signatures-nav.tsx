'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { FileText, LayoutDashboard, Settings, Users } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@kit/ui/tabs';

import pathsConfig from '~/config/paths.config';

const items = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: pathsConfig.app.accountSignaturesDashboard,
    match: '/signatures',
  },
  {
    label: 'Staff',
    icon: Users,
    href: pathsConfig.app.accountSignaturesStaff,
    match: '/signatures/staff',
  },
  {
    label: 'Templates',
    icon: FileText,
    href: pathsConfig.app.accountSignaturesTemplates,
    match: '/signatures/templates',
  },
  {
    label: 'Settings',
    icon: Settings,
    href: pathsConfig.app.accountSignaturesSettings,
    match: '/signatures/settings',
  },
];

export function SignaturesNav({ accountSlug }: { accountSlug: string }) {
  const pathname = usePathname();
  const active =
    items
      .filter((item) => pathname.includes(item.match))
      .sort((a, b) => b.match.length - a.match.length)[0]?.label ?? 'Dashboard';

  return (
    <Tabs value={active} className="w-full">
      <TabsList className="h-auto flex-wrap justify-start gap-1 border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-1">
        {items.map((item) => {
          const Icon = item.icon;
          const href = item.href.replace('[account]', accountSlug);

          return (
            <TabsTrigger
              key={item.label}
              value={item.label}
              asChild
              className="gap-2 rounded-md data-[state=active]:bg-[#1F2C43] data-[state=active]:text-[var(--workspace-shell-text)]"
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
