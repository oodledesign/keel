import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';
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

  const campaignsHref = pathsConfig.app.accountEmailCampaigns.replace(
    '[account]',
    account,
  );

  return (
    <>
      <div className="px-4 pt-4 pb-1 lg:px-6">
        <Link
          href={campaignsHref}
          className="text-sm text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--workspace-shell-accent-text)]"
          data-test="campaign-back-to-all"
        >
          <Trans i18nKey="campaigns:backToList" />
        </Link>
      </div>
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
