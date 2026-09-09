import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';

import { hasCampaignsGrowthFeatures } from '~/lib/billing/campaign-pricing';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { CampaignContactImportClient } from '../../_components/campaign-contact-import-client';
import { CampaignUpgradeCta } from '../../_components/campaign-upgrade-cta';
import { CampaignsHubNav } from '../../_components/campaigns-hub-nav';
import { loadCampaignsGrowthHub } from '../../_lib/server/campaigns.loader';

interface ImportPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Import campaign contacts',
});

async function ImportPage({ params }: ImportPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const data = await loadCampaignsGrowthHub(workspace.account.id);
  const growth = hasCampaignsGrowthFeatures(data.snapshot.planTier);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Upload contacts"
        description="CSV → preview and map → confirm. Valid rows become contacts and a list."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignsHubNav accountSlug={accountSlug} />
        {growth ? (
          <Suspense fallback={null}>
            <CampaignContactImportClient
              accountId={workspace.account.id}
              accountSlug={accountSlug}
              lists={data.lists}
            />
          </Suspense>
        ) : (
          <CampaignUpgradeCta
            accountSlug={accountSlug}
            nextTierName={data.snapshot.nextTierName ?? 'Growth'}
            message="CSV list import starts on Campaigns Growth."
          />
        )}
      </PageBody>
    </>
  );
}

export default withI18n(ImportPage);
