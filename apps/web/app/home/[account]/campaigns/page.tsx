import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { getDefaultAccountPath } from '../_lib/role-access';
import { isWorkModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { CampaignsListClient } from './_components/campaigns-list-client';
import { loadCampaignsPageData } from './_lib/server/campaign-page.loader';

interface CampaignsPageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: CampaignsPageProps) {
  return { title: 'Campaign trackers' };
}

async function CampaignsPage({ params }: CampaignsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  if (!isWorkModuleEnabled(workspace.moduleSettings, 'jobs')) {
    redirect(
      getDefaultAccountPath(accountSlug, {
        permissions: (workspace.account as { permissions?: string[] | null })
          .permissions,
        role: (workspace.account as { role?: string | null }).role,
        company_role: (workspace.account as { company_role?: string | null })
          .company_role,
      }),
    );
  }

  const data = await loadCampaignsPageData(accountSlug);

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 md:px-6">
      <CampaignsListClient
        accountId={data.accountId}
        accountSlug={data.accountSlug}
        projects={data.projects}
        canEdit={data.canEdit}
      />
    </PageBody>
  );
}

export default CampaignsPage;
