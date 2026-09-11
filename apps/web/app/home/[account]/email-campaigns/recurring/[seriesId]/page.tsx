import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { CampaignSeriesDetail } from '../../_components/campaign-series-detail';
import { CampaignsHubNav } from '../../_components/campaigns-hub-nav';
import { loadCampaignSeriesDetail } from '../../_lib/server/campaigns.loader';

interface SeriesDetailPageProps {
  params: Promise<{ account: string; seriesId: string }>;
}

export const generateMetadata = async () => ({
  title: 'Recurring series',
});

async function SeriesDetailPage({ params }: SeriesDetailPageProps) {
  const { account, seriesId } = await params;
  const workspace = await loadTeamWorkspace(account);

  let data: Awaited<ReturnType<typeof loadCampaignSeriesDetail>>;
  try {
    data = await loadCampaignSeriesDetail(workspace.account.id, seriesId);
  } catch {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={data.series.name}
        description="Upcoming weekly instances. Open a week to edit, then mark it Ready."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignsHubNav accountSlug={account} />
        <CampaignSeriesDetail
          accountId={workspace.account.id}
          accountSlug={account}
          series={data.series}
          instances={data.instances}
        />
      </PageBody>
    </>
  );
}

export default withI18n(SeriesDetailPage);
