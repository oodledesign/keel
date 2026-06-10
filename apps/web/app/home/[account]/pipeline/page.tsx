import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { loadPipelineDataForAccount } from '~/home/(user)/_lib/server/pipeline.loader';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../_lib/role-access';
import { isWorkModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';

import { WorkspacePipelineBoardWrapper } from './_components/workspace-pipeline-board-wrapper';

interface TeamAccountPipelinePageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('common:routes.pipeline');
  return { title };
};

async function TeamAccountPipelinePage({ params }: TeamAccountPipelinePageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  if (!isWorkModuleEnabled(workspace.moduleSettings, 'pipeline')) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const accountId = workspace.account.id as string;
  const data = await loadPipelineDataForAccount(accountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={<Trans i18nKey="common:routes.pipeline" />}
        description="Track leads and opportunities for this workspace. Won deals can be turned into clients."
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
        <WorkspacePipelineBoardWrapper
          initialData={data}
          accountSlug={accountSlug}
          accountId={accountId}
        />
      </PageBody>
    </>
  );
}

export default withI18n(TeamAccountPipelinePage);
