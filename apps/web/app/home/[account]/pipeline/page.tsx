import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { loadPipelineDataForAccount } from '~/home/(user)/_lib/server/pipeline.loader';
import { withI18n } from '~/lib/i18n/with-i18n';

import { getDefaultAccountPath } from '../_lib/role-access';
import { isWorkModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { WorkspacePipelineBoardWrapper } from './_components/workspace-pipeline-board-wrapper';

interface TeamAccountPipelinePageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  return { title: 'Pipeline' };
};

async function TeamAccountPipelinePage({
  params,
}: TeamAccountPipelinePageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  if (!isWorkModuleEnabled(workspace.moduleSettings, 'pipeline')) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const accountId = workspace.account.id as string;
  const data = await loadPipelineDataForAccount(accountId);

  return (
    <PageBody className="flex min-h-0 flex-1 flex-col bg-[var(--workspace-shell-canvas)] p-0">
      <WorkspacePipelineBoardWrapper
        initialData={data}
        accountSlug={accountSlug}
        accountId={accountId}
      />
    </PageBody>
  );
}

export default withI18n(TeamAccountPipelinePage);
