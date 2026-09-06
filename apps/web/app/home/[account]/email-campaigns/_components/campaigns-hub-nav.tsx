'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

const TABS = [
  { key: 'campaigns', label: 'Campaigns', path: 'accountEmailCampaigns' },
  {
    key: 'audiences',
    label: 'Audiences',
    path: 'accountEmailCampaignAudiences',
  },
  {
    key: 'automations',
    label: 'Automations',
    path: 'accountEmailCampaignAutomations',
  },
] as const;

export function CampaignsHubNav({ accountSlug }: { accountSlug: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1" data-test="campaigns-hub-nav">
      {TABS.map((tab) => {
        const href = pathsConfig.app[tab.path].replace(
          '[account]',
          accountSlug,
        );
        const active =
          tab.key === 'campaigns'
            ? pathname === href || pathname === `${href}/`
            : pathname?.startsWith(href);
        return (
          <Link
            key={tab.key}
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active
                ? `bg-[var(--workspace-shell-panel-hover)] ${workspaceText}`
                : workspaceTextMuted
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
