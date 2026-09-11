import { notFound } from 'next/navigation';

import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { CampaignSendPanel } from '../../_components/campaign-send-panel';
import {
  loadCampaignDetail,
  loadCampaignLinkedFormSubmissions,
} from '../../_lib/server/campaigns.loader';

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

  const linkedForm = await loadCampaignLinkedFormSubmissions(
    workspace.account.id,
    data.campaign.bodyDocument?.formLink?.formId,
  );

  return (
    <CampaignSendPanel
      accountId={workspace.account.id}
      accountSlug={account}
      campaign={data.campaign}
      recipients={data.recipients}
      audienceCount={data.audienceCount}
      usage={data.usage}
      analytics={data.analytics}
      brand={data.brand}
      clients={data.audienceOptions.clients}
      linkedForm={linkedForm}
    />
  );
}

export default withI18n(CampaignSendPage);
