import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { campaignTemplateWorkspaceFromProfile } from '~/lib/campaigns/templates';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { CampaignAudienceCard } from './_components/campaign-audience-card';
import { CampaignUsageCard } from './_components/campaign-usage-card';
import { CampaignsList } from './_components/campaigns-list';
import { loadCampaignsPage } from './_lib/server/campaigns.loader';

interface CampaignsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Campaigns',
});

async function CampaignsPage({ params }: CampaignsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const data = await loadCampaignsPage(workspace.account.id);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title={<Trans i18nKey="campaigns:title" />}
        description={<Trans i18nKey="campaigns:description" />}
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignUsageCard
          subscriberCount={data.subscriberCount}
          usage={data.usage}
          fromEmail={data.brand.contact_email}
        />
        <CampaignAudienceCard
          subscriberCount={data.subscriberCount}
          subscribers={data.subscribers}
        />
        <CampaignsList
          accountId={workspace.account.id}
          accountSlug={accountSlug}
          campaigns={data.campaigns}
          brand={data.brand}
          workspace={campaignTemplateWorkspaceFromProfile(
            workspace.workspaceProfile,
          )}
        />
      </PageBody>
    </>
  );
}

export default withI18n(CampaignsPage);
