import Link from 'next/link';

import { Button } from '@kit/ui/button';

import { campaignBillingHref } from '~/lib/campaigns/campaign-usage';
import { workspaceBtnPrimary, workspaceTextMuted } from '~/lib/workspace-ui';

export function CampaignUpgradeCta({
  accountSlug,
  nextTierName,
  message,
}: {
  accountSlug: string;
  nextTierName?: string | null;
  message: string;
}) {
  return (
    <div
      className="space-y-2 rounded-lg border border-[color:var(--ozer-accent)]/40 bg-[var(--ozer-accent-subtle)] p-3"
      data-test="campaign-upgrade-cta"
    >
      <p className={`text-sm ${workspaceTextMuted}`}>{message}</p>
      <Button asChild size="sm" className={workspaceBtnPrimary}>
        <Link href={campaignBillingHref(accountSlug)}>
          {nextTierName
            ? `Upgrade to ${nextTierName}`
            : 'Open Campaigns billing'}
        </Link>
      </Button>
    </div>
  );
}
