import { PageBody } from '@kit/ui/page';

import { hasCampaignsGrowthFeatures } from '~/lib/billing/campaign-pricing';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { CampaignAudienceListsHub } from '../_components/campaign-audience-lists-hub';
import { CampaignUpgradeCta } from '../_components/campaign-upgrade-cta';
import { CampaignsHubNav } from '../_components/campaigns-hub-nav';
import { loadCampaignsGrowthHub } from '../_lib/server/campaigns.loader';

interface AudiencesPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Campaign audiences' });

async function AudiencesPage({ params }: AudiencesPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const data = await loadCampaignsGrowthHub(workspace.account.id);
  const growth = hasCampaignsGrowthFeatures(data.snapshot.planTier);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Audiences"
        description="Mailing lists for campaigns. Open a list to edit members, rules, or CSV."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignsHubNav accountSlug={accountSlug} />
        {growth ? (
          <CampaignAudienceListsHub
            accountSlug={accountSlug}
            lists={data.lists}
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

export default withI18n(AudiencesPage);
