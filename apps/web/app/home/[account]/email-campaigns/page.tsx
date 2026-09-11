import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { campaignTemplateWorkspaceFromProfile } from '~/lib/campaigns/templates';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { CampaignAudienceCard } from './_components/campaign-audience-card';
import { CampaignUsageCard } from './_components/campaign-usage-card';
import { CampaignsHubNav } from './_components/campaigns-hub-nav';
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
        <CampaignsHubNav accountSlug={accountSlug} />
        <div
          className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
          data-test="campaigns-hub-layout"
        >
          <aside
            className="min-w-0 space-y-4 lg:sticky lg:top-6"
            data-test="campaigns-hub-summary"
          >
            <CampaignUsageCard
              snapshot={data.usage}
              accountSlug={accountSlug}
              fromEmail={data.brand.contact_email}
              layout="stack"
            />
            <CampaignAudienceCard
              subscriberCount={data.subscriberCount}
              subscribers={data.subscribers}
            />
          </aside>
          <div className="min-w-0" data-test="campaigns-hub-list">
            <CampaignsList
              accountId={workspace.account.id}
              accountSlug={accountSlug}
              campaigns={data.campaigns}
              seriesCount={data.series.length}
              brand={data.brand}
              workspace={campaignTemplateWorkspaceFromProfile(
                workspace.workspaceProfile,
              )}
            />
          </div>
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(CampaignsPage);
