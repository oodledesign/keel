import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { CampaignsHubNav } from '../_components/campaigns-hub-nav';
import { CampaignsRecurringPlanner } from '../_components/campaigns-recurring-planner';
import { loadCampaignsRecurringPage } from '../_lib/server/campaigns.loader';

interface RecurringCampaignsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Recurring campaigns',
});

async function RecurringCampaignsPage({ params }: RecurringCampaignsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const data = await loadCampaignsRecurringPage(workspace.account.id);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Recurring"
        description="Weekly series with draft instances generated ahead. Mark a week Ready before it can send."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignsHubNav accountSlug={accountSlug} />
        <CampaignsRecurringPlanner
          accountId={workspace.account.id}
          accountSlug={accountSlug}
          groups={data.groups}
        />
      </PageBody>
    </>
  );
}

export default withI18n(RecurringCampaignsPage);
