import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { campaignTemplateWorkspaceFromProfile } from '~/lib/campaigns/templates';
import { listContactCustomFields } from '~/lib/contacts/custom-fields.service';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { CampaignContentPanel } from '../../_components/campaign-content-panel';
import { CampaignMergeFieldsProvider } from '../../_components/campaign-merge-fields-context';
import { loadCampaignDetail } from '../../_lib/server/campaigns.loader';

interface CampaignContentPageProps {
  params: Promise<{ account: string; campaignId: string }>;
}

export const generateMetadata = async () => ({
  title: 'Campaign content',
});

async function CampaignContentPage({ params }: CampaignContentPageProps) {
  const { account, campaignId } = await params;
  const workspace = await loadTeamWorkspace(account);

  let data: Awaited<ReturnType<typeof loadCampaignDetail>>;
  try {
    data = await loadCampaignDetail(workspace.account.id, campaignId);
  } catch {
    notFound();
  }

  const customFields = await listContactCustomFields(
    getSupabaseServerClient(),
    workspace.account.id,
  );

  return (
    <CampaignMergeFieldsProvider customFields={customFields}>
      <CampaignContentPanel
        accountId={workspace.account.id}
        accountSlug={account}
        campaign={data.campaign}
        brand={data.brand}
        publishedForms={data.publishedForms}
        workspace={campaignTemplateWorkspaceFromProfile(
          workspace.workspaceProfile,
        )}
      />
    </CampaignMergeFieldsProvider>
  );
}

export default withI18n(CampaignContentPage);
