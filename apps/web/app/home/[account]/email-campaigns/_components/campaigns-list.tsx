import Link from 'next/link';

import { Mail } from 'lucide-react';

import { Badge } from '@kit/ui/badge';

import pathsConfig from '~/config/paths.config';
import type { CampaignBrand } from '~/lib/campaigns/campaign-document';
import type { EmailCampaign } from '~/lib/campaigns/campaign.types';
import type { CampaignTemplateWorkspace } from '~/lib/campaigns/templates';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { CreateCampaignButton } from './create-campaign-button';

const STATUS_LABEL: Record<EmailCampaign['status'], string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

export function CampaignsList({
  accountId,
  accountSlug,
  campaigns,
  brand,
  workspace,
}: {
  accountId: string;
  accountSlug: string;
  campaigns: EmailCampaign[];
  brand: CampaignBrand;
  workspace: CampaignTemplateWorkspace;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateCampaignButton
          accountId={accountId}
          accountSlug={accountSlug}
          brand={brand}
          workspace={workspace}
        />
      </div>

      {campaigns.length === 0 ? (
        <div className={`${workspacePanelCard} px-6 py-12 text-center`}>
          <Mail className={`mx-auto h-10 w-10 ${workspaceTextMuted}`} />
          <h2 className={`mt-4 text-lg font-semibold ${workspaceText}`}>
            No campaigns yet
          </h2>
          <p className={`mx-auto mt-2 max-w-md text-sm ${workspaceTextMuted}`}>
            Pick a branded starter, edit the blocks, then send to your
            mailing-list contacts. Unsubscribes are respected automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((campaign) => {
            const href = pathsConfig.app.accountEmailCampaignDetail
              .replace('[account]', accountSlug)
              .replace('[campaignId]', campaign.id);

            return (
              <Link
                key={campaign.id}
                href={href}
                className={`${workspacePanelCard} block px-4 py-4 transition-colors hover:bg-[var(--workspace-shell-panel-hover)]`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className={`font-semibold ${workspaceText}`}>
                      {campaign.name}
                    </h3>
                    <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                      {campaign.subject || 'No subject yet'}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {STATUS_LABEL[campaign.status]}
                  </Badge>
                </div>
                {campaign.status === 'sent' || campaign.status === 'sending' ? (
                  <p className={`mt-3 text-xs ${workspaceTextMuted}`}>
                    {campaign.sentCount} sent · {campaign.failedCount} failed ·{' '}
                    {campaign.unsubscribedCount} unsubscribed
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
