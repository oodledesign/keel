import { notFound } from 'next/navigation';

import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { CampaignSendPanel } from '../../_components/campaign-send-panel';
import { CampaignUsageCard } from '../../_components/campaign-usage-card';
import { loadCampaignDetail } from '../../_lib/server/campaigns.loader';

interface CampaignSendPageProps {
  params: Promise<{ account: string; campaignId: string }>;
}

export const generateMetadata = async () => ({
  title: 'Send campaign',
});

async function CampaignSendPage({ params }: CampaignSendPageProps) {
  const { account, campaignId } = await params;
  const workspace = await loadTeamWorkspace(account);

  let data: Awaited<ReturnType<typeof loadCampaignDetail>>;
  try {
    data = await loadCampaignDetail(workspace.account.id, campaignId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <CampaignUsageCard
        subscriberCount={data.subscriberCount}
        usage={data.usage}
        fromEmail={data.campaign.fromEmail ?? data.brand.contact_email}
        accountSlug={account}
      />
      <CampaignSendPanel
        accountId={workspace.account.id}
        accountSlug={account}
        campaign={data.campaign}
        recipients={data.recipients}
        audienceCount={data.audienceCount}
        usage={data.usage}
        events={data.events}
        features={data.features}
        brand={data.brand}
        clients={data.audienceOptions.clients}
      />
    </div>
  );
}

export default withI18n(CampaignSendPage);
