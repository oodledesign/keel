import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { CommercialReportsDashboard } from './_components/commercial-reports-dashboard';
import { createCommercialReportsService } from './_lib/server/commercial-reports.service';

interface CommercialReportsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Reports' });

async function CommercialReportsPage({ params }: CommercialReportsPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const metrics = await createCommercialReportsService(
    getSupabaseServerClient(),
  ).getMetrics(accountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Reports"
        description="Commercial property performance and pipeline snapshot."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 lg:px-6">
        <CommercialReportsDashboard metrics={metrics} />
      </PageBody>
    </>
  );
}

export default withI18n(CommercialReportsPage);
