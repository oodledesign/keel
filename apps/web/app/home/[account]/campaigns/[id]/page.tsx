import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ChevronLeft } from 'lucide-react';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';

import { getDefaultAccountPath } from '../../_lib/role-access';
import { isWorkModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { CampaignTableClient } from '../_components/campaign-table-client';
import { loadCampaignDetailPageData } from '../_lib/server/campaign-page.loader';

interface CampaignDetailPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: CampaignDetailPageProps) {
  const { account, id } = await params;
  const data = await loadCampaignDetailPageData(account, id);
  return { title: data.project.name };
}

async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { account: accountSlug, id } = await params;
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

  let data;
  try {
    data = await loadCampaignDetailPageData(accountSlug, id);
  } catch {
    notFound();
  }

  const listPath = pathsConfig.app.accountCampaigns.replace('[account]', accountSlug);

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 md:px-6">
      <Link
        href={listPath}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        All campaigns
      </Link>
      <CampaignTableClient
        accountId={data.accountId}
        accountSlug={data.accountSlug}
        project={data.project}
        linkOptions={data.linkOptions}
        canEdit={data.canEdit}
      />
    </PageBody>
  );
}

export default CampaignDetailPage;
