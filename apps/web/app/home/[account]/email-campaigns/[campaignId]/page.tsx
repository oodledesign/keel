import { notFound } from 'next/navigation';

import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { CampaignSettingsPanel } from '../_components/campaign-settings-panel';
import { loadCampaignDetail } from '../_lib/server/campaigns.loader';

interface CampaignSettingsPageProps {
  params: Promise<{ account: string; campaignId: string }>;
}

export const generateMetadata = async () => ({
  title: 'Campaign settings',
});

async function CampaignSettingsPage({ params }: CampaignSettingsPageProps) {
  const { account, campaignId } = await params;
  const workspace = await loadTeamWorkspace(account);

  let data: Awaited<ReturnType<typeof loadCampaignDetail>>;
  try {
    data = await loadCampaignDetail(workspace.account.id, campaignId);
  } catch {
    notFound();
  }

  return (
    <CampaignSettingsPanel
      accountId={workspace.account.id}
      accountSlug={account}
      campaign={data.campaign}
      audienceCount={data.audienceCount}
      audienceOptions={data.audienceOptions}
      lists={data.lists}
      usage={data.usage}
      brand={data.brand}
      sendingDomain={data.sendingDomain}
    />
  );
}

export default withI18n(CampaignSettingsPage);
