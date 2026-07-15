'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { FileText, LayoutDashboard, Settings, Users } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@kit/ui/tabs';

import pathsConfig from '~/config/paths.config';

import type { SignaturesMailProvider } from '../_lib/server/signatures-data';
import { SignaturesActionsBar } from './signatures-actions-bar';

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

export function SignaturesNav({
  accountSlug,
  accountId,
  showActions = false,
  mailProvider,
  mailActionsDisabled,
}: {
  accountSlug: string;
  accountId?: string;
  showActions?: boolean;
  mailProvider?: SignaturesMailProvider | null;
  mailActionsDisabled?: boolean;
}) {
  const pathname = usePathname();
  const active =
    items
      .filter((item) => pathname.includes(item.match))
      .sort((a, b) => b.match.length - a.match.length)[0]?.label ?? 'Dashboard';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <Tabs value={active} className="min-w-0 flex-1">
        <TabsList className="h-auto flex-wrap justify-start gap-1 border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-1">
          {items.map((item) => {
            const Icon = item.icon;
            const href = item.href.replace('[account]', accountSlug);

            return (
              <TabsTrigger
                key={item.label}
                value={item.label}
                asChild
                className="gap-2 text-[var(--workspace-shell-text-muted)] data-[state=active]:border data-[state=active]:border-[var(--ozer-accent)]/30 data-[state=active]:bg-[var(--workspace-shell-panel)] data-[state=active]:text-[var(--workspace-shell-text)] data-[state=active]:shadow-none"
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

      {showActions && accountId ? (
        <SignaturesActionsBar
          accountId={accountId}
          mailProvider={mailProvider}
          mailActionsDisabled={mailActionsDisabled}
          compact
        />
      ) : null}
    </div>
  );
}
