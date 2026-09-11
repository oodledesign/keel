import Link from 'next/link';

import { FolderKanban, Mail } from 'lucide-react';

import pathsConfig from '~/config/paths.config';
import type { CampaignBrand } from '~/lib/campaigns/campaign-document';
import type { EmailCampaign } from '~/lib/campaigns/campaign.types';
import type { CampaignTemplateWorkspace } from '~/lib/campaigns/templates';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { CampaignListThumbnail } from './campaign-list-thumbnail';
import { CampaignStatusBadge } from './campaign-status-badge';
import { CreateCampaignButton } from './create-campaign-button';

export function CampaignsList({
  accountId,
  accountSlug,
  campaigns,
  seriesCount = 0,
  brand,
  workspace,
}: {
  accountId: string;
  accountSlug: string;
  campaigns: EmailCampaign[];
  seriesCount?: number;
  brand: CampaignBrand;
  workspace: CampaignTemplateWorkspace;
}) {
  const recurringHref = pathsConfig.app.accountEmailCampaignRecurring.replace(
    '[account]',
    accountSlug,
  );

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

      {seriesCount > 0 ? (
        <Link
          href={recurringHref}
          data-test="campaigns-recurring-folder"
          className={`${workspacePanelCard} block px-4 py-4 transition-colors hover:bg-[var(--workspace-shell-panel-hover)]`}
        >
          <div className="flex items-start gap-3">
            <FolderKanban className={`mt-0.5 h-5 w-5 ${workspaceTextMuted}`} />
            <div>
              <h3 className={`font-semibold ${workspaceText}`}>Recurring</h3>
              <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                {seriesCount} series · weekly drafts generated ahead
              </p>
            </div>
          </div>
        </Link>
      ) : null}

      {campaigns.length === 0 && seriesCount === 0 ? (
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
                data-test="campaign-card"
                className={`${workspacePanelCard} block px-4 py-4 transition-colors hover:bg-[var(--workspace-shell-panel-hover)]`}
              >
                <div className="flex items-start gap-3">
                  <CampaignListThumbnail
                    brand={brand}
                    subject={campaign.subject}
                    bodyDocument={campaign.bodyDocument}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className={`font-semibold ${workspaceText}`}>
                          {campaign.name}
                        </h3>
                        <p
                          className={`mt-1 truncate text-sm ${workspaceTextMuted}`}
                        >
                          {campaign.subject || 'No subject yet'}
                        </p>
                      </div>
                      <CampaignStatusBadge status={campaign.status} />
                    </div>
                    {campaign.status === 'sent' ||
                    campaign.status === 'sending' ? (
                      <p className={`mt-3 text-xs ${workspaceTextMuted}`}>
                        {campaign.sentCount} sent · {campaign.failedCount}{' '}
                        failed · {campaign.unsubscribedCount} unsubscribed
                      </p>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
