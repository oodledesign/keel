import { PageBody } from '@kit/ui/page';

import { hasCampaignsGrowthFeatures } from '~/lib/billing/campaign-pricing';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { CampaignAudienceListEditor } from '../../_components/campaign-audience-list-editor';
import { CampaignsHubNav } from '../../_components/campaigns-hub-nav';
import { loadCampaignAudienceEditor } from '../../_lib/server/campaigns.loader';

interface NewAudienceListPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'New audience list' });

async function NewAudienceListPage({ params }: NewAudienceListPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const data = await loadCampaignAudienceEditor(workspace.account.id);
  const growth = hasCampaignsGrowthFeatures(data.snapshot.planTier);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="New list"
        description={
          growth
            ? 'Logic filters, a manual membership list, a category, or a CSV upload.'
            : 'A manual membership list or a CSV upload. Logic filters start on Growth.'
        }
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignsHubNav accountSlug={accountSlug} />
        <CampaignAudienceListEditor
          mode="create"
          accountId={workspace.account.id}
          accountSlug={accountSlug}
          categories={data.categories}
          contacts={data.contacts}
          allowLogicFilters={growth}
        />
      </PageBody>
    </>
  );
}

export default withI18n(NewAudienceListPage);
