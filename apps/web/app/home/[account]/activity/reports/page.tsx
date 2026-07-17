import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { ActivityReportsContent } from '../_components/activity-reports-content';
import { loadActivityReportsData } from '../_lib/server/activity-reports.loader';

interface ActivityReportsPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => ({
  title: 'Activity reports',
});

function readSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

async function ActivityReportsPage({
  params,
  searchParams,
}: ActivityReportsPageProps) {
  const accountSlug = (await params).account;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewDashboard) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const data = await loadActivityReportsData(
    accountSlug,
    {
      from: readSearchParam(query.from),
      to: readSearchParam(query.to),
      range: readSearchParam(query.range),
    },
    readSearchParam(query.view),
    {
      client: readSearchParam(query.client),
      project: readSearchParam(query.project),
      member: readSearchParam(query.member),
      app: readSearchParam(query.app),
    },
  );

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Activity reports"
        description="See how much time was tracked by client, project, app, or team member."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)]">
        <ActivityReportsContent data={data} />
      </PageBody>
    </>
  );
}

export default ActivityReportsPage;
