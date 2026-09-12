import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { hasCampaignsGrowthFeatures } from '~/lib/billing/campaign-pricing';
import { audienceListTypeLabel } from '~/lib/campaigns/campaign-audience-filters';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { CampaignAudienceListEditor } from '../../_components/campaign-audience-list-editor';
import { CampaignUpgradeCta } from '../../_components/campaign-upgrade-cta';
import { CampaignsHubNav } from '../../_components/campaigns-hub-nav';
import { loadCampaignAudienceListDetail } from '../../_lib/server/campaigns.loader';

interface AudienceListDetailPageProps {
  params: Promise<{ account: string; listId: string }>;
}

export async function generateMetadata({
  params,
}: AudienceListDetailPageProps) {
  const { account, listId } = await params;
  const workspace = await loadTeamWorkspace(account);
  const data = await loadCampaignAudienceListDetail(
    workspace.account.id,
    listId,
  );
  return { title: data?.list.name ?? 'Audience list' };
}

async function AudienceListDetailPage({ params }: AudienceListDetailPageProps) {
  const { account, listId } = await params;
  const workspace = await loadTeamWorkspace(account);
  const data = await loadCampaignAudienceListDetail(
    workspace.account.id,
    listId,
  );

  if (!data) {
    notFound();
  }

  const growth = hasCampaignsGrowthFeatures(data.snapshot.planTier);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={data.list.name}
        description={`${audienceListTypeLabel(data.list.source)}. Edit members, rules, or upload a CSV.`}
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignsHubNav accountSlug={account} />
        {growth ? (
          <CampaignAudienceListEditor
            mode="edit"
            accountId={workspace.account.id}
            accountSlug={account}
            categories={data.categories}
            contacts={data.contacts}
            list={data.list}
            members={data.members}
          />
        ) : (
          <CampaignUpgradeCta
            accountSlug={account}
            nextTierName={data.snapshot.nextTierName ?? 'Growth'}
            message="Saved audience lists and logic filters start on Campaigns Growth."
          />
        )}
      </PageBody>
    </>
  );
}

export default withI18n(AudienceListDetailPage);
