import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { CampaignNav } from '../_components/campaign-nav';
import { loadCampaignDetail } from '../_lib/server/campaigns.loader';

interface CampaignLayoutProps {
  children: React.ReactNode;
  params: Promise<{ account: string; campaignId: string }>;
}

async function CampaignLayout({ children, params }: CampaignLayoutProps) {
  const { account, campaignId } = await params;
  const workspace = await loadTeamWorkspace(account);

  let data: Awaited<ReturnType<typeof loadCampaignDetail>>;
  try {
    data = await loadCampaignDetail(workspace.account.id, campaignId);
  } catch {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={data.campaign.name}
        description={data.campaign.subject || 'Draft campaign'}
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignNav accountSlug={account} campaignId={campaignId} />
        {children}
      </PageBody>
    </>
  );
}

export default withI18n(CampaignLayout);
