'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

const TABS = [
  { key: 'settings', label: 'Settings', suffix: '' },
  { key: 'content', label: 'Content', suffix: '/content' },
  { key: 'send', label: 'Send', suffix: '/send' },
] as const;

export function CampaignNav({
  accountSlug,
  campaignId,
}: {
  accountSlug: string;
  campaignId: string;
}) {
  const pathname = usePathname();
  const base = pathsConfig.app.accountEmailCampaignDetail
    .replace('[account]', accountSlug)
    .replace('[campaignId]', campaignId);

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-[color:var(--workspace-shell-border)] pb-3"
      data-test="campaign-nav"
    >
      {TABS.map((tab) => {
        const href = `${base}${tab.suffix}`;
        const active =
          tab.key === 'settings'
            ? pathname === base || pathname === `${base}/`
            : pathname?.endsWith(tab.suffix);
        return (
          <Link
            key={tab.key}
            href={href}
            data-test={`campaign-nav-${tab.key}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
