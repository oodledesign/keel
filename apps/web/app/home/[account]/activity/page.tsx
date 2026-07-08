import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { ActivityPageContent } from './_components/activity-page-content';
import { loadActivityPageData } from './_lib/server/activity-page.loader';

interface ActivityPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => ({
  title: 'Activity',
});

function readSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

async function ActivityPage({ params, searchParams }: ActivityPageProps) {
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

  const data = await loadActivityPageData(
    accountSlug,
    {
      from: readSearchParam(query.from),
      to: readSearchParam(query.to),
      range: readSearchParam(query.range),
    },
    readSearchParam(query.view),
    readSearchParam(query.status),
  );

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Activity"
        description="Review desktop activity captured by KeelAssistant and assign it to projects and clients."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)]">
        <ActivityPageContent data={data} />
      </PageBody>
    </>
  );
}

export default ActivityPage;
