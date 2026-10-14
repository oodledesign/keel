'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import {
  workspaceBorder,
  workspaceTabActive,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

const TABS = [
  {
    label: 'Overview',
    path: pathsConfig.app.accountInstagramAutoreply,
    exact: true,
  },
  {
    label: 'Automations',
    path: pathsConfig.app.accountInstagramAutoreplyTriggers,
  },
  { label: 'Inbox', path: pathsConfig.app.accountInstagramAutoreplyInbox },
  {
    label: 'Contacts',
    path: pathsConfig.app.accountInstagramAutoreplyContacts,
  },
  {
    label: 'Analytics',
    path: pathsConfig.app.accountInstagramAutoreplyAnalytics,
  },
  {
    label: 'Activity',
    path: pathsConfig.app.accountInstagramAutoreplyActivity,
  },
];

export function InstagramSubnav({ account }: { account: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Instagram sections"
      className={`mx-4 flex gap-1 overflow-x-auto border-b lg:mx-0 ${workspaceBorder}`}
    >
      {TABS.map((tab) => {
        const href = tab.path.replace('[account]', account);
        const active = tab.exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? workspaceTabActive
                : `border-transparent ${workspaceTextMuted}`
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
