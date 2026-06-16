import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import {
  assertWorkspacePlannerAccess,
  loadWorkspacePlannerPageData,
} from '~/lib/planner/load-planner-data';
import pathsConfig from '~/config/paths.config';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { PlannerPageClient } from '~/home/(user)/planner/_components/PlannerPageClient';

interface WorkspacePlannerPageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Planner' };

async function WorkspacePlannerPage({ params }: WorkspacePlannerPageProps) {
  const accountSlug = (await params).account;

  try {
    await assertWorkspacePlannerAccess(accountSlug);
  } catch {
    redirect(pathsConfig.app.accountHome.replace('[account]', accountSlug));
  }

  const data = await loadWorkspacePlannerPageData(accountSlug);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title="Planner"
        description="Build a day or week plan from this workspace’s tasks — or everything across Keel."
        account={accountSlug}
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-white lg:px-6">
        <PlannerPageClient initialData={data} />
      </PageBody>
    </>
  );
}

export default withI18n(WorkspacePlannerPage);
