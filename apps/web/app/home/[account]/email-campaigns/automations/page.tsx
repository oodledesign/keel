import { PageBody } from '@kit/ui/page';

import { hasCampaignsGrowthFeatures } from '~/lib/billing/campaign-pricing';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { CampaignAutomationsPanel } from '../_components/campaign-automations-panel';
import { CampaignUpgradeCta } from '../_components/campaign-upgrade-cta';
import { CampaignsHubNav } from '../_components/campaigns-hub-nav';
import { loadCampaignsGrowthHub } from '../_lib/server/campaigns.loader';

interface AutomationsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Campaign automations' });

async function AutomationsPage({ params }: AutomationsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const data = await loadCampaignsGrowthHub(workspace.account.id);
  const growth = hasCampaignsGrowthFeatures(data.snapshot.planTier);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Automations"
        description="Welcome new mailing-list subscribers with a campaign email."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignsHubNav accountSlug={accountSlug} />
        {growth ? (
          <CampaignAutomationsPanel
            accountId={workspace.account.id}
            accountSlug={accountSlug}
            automations={data.automations}
            campaigns={data.campaigns}
          />
        ) : (
          <CampaignUpgradeCta
            accountSlug={accountSlug}
            nextTierName={data.snapshot.nextTierName ?? 'Growth'}
            message="Welcome automations start on Campaigns Growth."
          />
        )}
      </PageBody>
    </>
  );
}

export default withI18n(AutomationsPage);
