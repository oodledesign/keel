import { PageBody } from '@kit/ui/page';

import { hasCampaignsGrowthFeatures } from '~/lib/billing/campaign-pricing';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { CampaignAudienceListEditor } from '../../_components/campaign-audience-list-editor';
import { CampaignUpgradeCta } from '../../_components/campaign-upgrade-cta';
import { CampaignsHubNav } from '../../_components/campaigns-hub-nav';
import { loadCampaignAudienceEditor } from '../../_lib/server/campaigns.loader';

interface NewAudienceListPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'New audience list' });

async function NewAudienceListPage({ params }: NewAudienceListPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const data = await loadCampaignAudienceEditor(workspace.account.id);
  const growth = hasCampaignsGrowthFeatures(data.snapshot.planTier);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="New list"
        description="Logic filters, a manual membership list, a category, or a CSV upload."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignsHubNav accountSlug={accountSlug} />
        {growth ? (
          <CampaignAudienceListEditor
            mode="create"
            accountId={workspace.account.id}
            accountSlug={accountSlug}
            categories={data.categories}
            contacts={data.contacts}
          />
        ) : (
          <CampaignUpgradeCta
            accountSlug={accountSlug}
            nextTierName={data.snapshot.nextTierName ?? 'Growth'}
            message="Saved audience lists and logic filters start on Campaigns Growth."
          />
        )}
      </PageBody>
    </>
  );
}

export default withI18n(NewAudienceListPage);
