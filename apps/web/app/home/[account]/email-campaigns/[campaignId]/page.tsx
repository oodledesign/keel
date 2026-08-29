import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { CampaignEditor } from '../_components/campaign-editor';
import { loadCampaignDetail } from '../_lib/server/campaigns.loader';

interface CampaignDetailPageProps {
  params: Promise<{ account: string; campaignId: string }>;
}

export const generateMetadata = async () => ({
  title: 'Campaign',
});

async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { account, campaignId } = await params;
  const workspace = await loadTeamWorkspace(account);

  try {
    const data = await loadCampaignDetail(workspace.account.id, campaignId);

    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={data.campaign.name}
          description={data.campaign.subject || 'Draft campaign'}
        />
        <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
          <CampaignEditor
            accountId={workspace.account.id}
            accountSlug={account}
            campaign={data.campaign}
            recipients={data.recipients}
            subscriberCount={data.subscriberCount}
            usage={data.usage}
            brand={data.brand}
          />
        </PageBody>
      </>
    );
  } catch {
    notFound();
  }
}

export default withI18n(CampaignDetailPage);
