import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';
import { campaignHasSendHistory } from '~/lib/campaigns/campaign-delete';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { CampaignDeleteButton } from '../_components/campaign-delete-button';
import { CampaignInstanceBanner } from '../_components/campaign-instance-banner';
import { CampaignNav } from '../_components/campaign-nav';
import { CampaignResendActions } from '../_components/campaign-resend-actions';
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

  const backHref = data.series
    ? pathsConfig.app.accountEmailCampaignSeriesDetail
        .replace('[account]', account)
        .replace('[seriesId]', data.series.id)
    : pathsConfig.app.accountEmailCampaigns.replace('[account]', account);

  return (
    <>
      <div className="px-4 pt-4 pb-1 lg:px-6">
        <Link
          href={backHref}
          className="text-sm text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--workspace-shell-accent-text)]"
          data-test="campaign-back-to-all"
        >
          <Trans
            i18nKey={
              data.series ? 'campaigns:backToSeries' : 'campaigns:backToList'
            }
          />
        </Link>
      </div>
      <TeamAccountLayoutPageHeader
        account={account}
        title={data.campaign.name}
        description={data.campaign.subject || 'Draft campaign'}
      >
        {data.series ? (
          <CampaignDeleteButton
            accountId={workspace.account.id}
            accountSlug={account}
            kind="series"
            id={data.series.id}
            name={data.series.name}
            hadSends={data.seriesHasSends}
            sending={data.seriesAnySending}
          />
        ) : (
          <CampaignDeleteButton
            accountId={workspace.account.id}
            accountSlug={account}
            kind="campaign"
            id={data.campaign.id}
            name={data.campaign.name}
            hadSends={campaignHasSendHistory(data.campaign)}
            sending={data.campaign.status === 'sending'}
          />
        )}
      </TeamAccountLayoutPageHeader>
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        {data.series ? (
          <CampaignInstanceBanner
            accountId={workspace.account.id}
            accountSlug={account}
            campaign={data.campaign}
            series={data.series}
          />
        ) : null}
        <CampaignNav accountSlug={account} campaignId={campaignId} />
        <CampaignResendActions
          accountId={workspace.account.id}
          accountSlug={account}
          campaign={data.campaign}
          hasRsvpForm={data.hasRsvpForm}
        />
        {children}
      </PageBody>
    </>
  );
}

export default withI18n(CampaignLayout);
