import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { PageBody } from '@kit/ui/page';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { listAudiencePickerOptions } from '~/lib/campaigns/resolve-campaign-audience';
import { campaignTemplateWorkspaceFromProfile } from '~/lib/campaigns/templates';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { CampaignsHubNav } from '../../_components/campaigns-hub-nav';
import { CreateSeriesWizard } from '../../_components/create-series-wizard';
import { loadCampaignsGrowthHub } from '../../_lib/server/campaigns.loader';

interface NewSeriesPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'New recurring series',
});

async function NewSeriesPage({ params }: NewSeriesPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const admin = getSupabaseServerAdminClient();
  const [hub, brand, audienceOptions] = await Promise.all([
    loadCampaignsGrowthHub(workspace.account.id),
    loadAccountBrandResolved(workspace.account.id),
    listAudiencePickerOptions(admin, workspace.account.id),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="New series"
        description="Weekly recurrence, audience, and baseline content. The next four weeks are created as drafts."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignsHubNav accountSlug={accountSlug} />
        <CreateSeriesWizard
          accountId={workspace.account.id}
          accountSlug={accountSlug}
          brand={brand}
          workspace={campaignTemplateWorkspaceFromProfile(
            workspace.workspaceProfile,
          )}
          audienceOptions={audienceOptions}
          lists={hub.lists}
          planTier={hub.snapshot.planTier}
        />
      </PageBody>
    </>
  );
}

export default withI18n(NewSeriesPage);
