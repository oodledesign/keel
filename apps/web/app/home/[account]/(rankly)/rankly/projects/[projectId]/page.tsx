import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../../../_components/team-account-layout-page-header';
import { RanklyProjectKeywordsManager } from '../../../_components/rankly-project-keywords-manager';
import {
  loadRanklyKeywordsForProject,
  loadRanklyProjectForTeam,
} from '../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../../_lib/work-account-path';

type RanklyProjectDetailPageProps = {
  params: Promise<{
    account: string;
    projectId: string;
  }>;
};

export default async function RanklyProjectDetailPage({
  params,
}: RanklyProjectDetailPageProps) {
  const { account, projectId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  const keywords = await loadRanklyKeywordsForProject(projectId, accountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={project.name}
        description={project.domain}
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-4 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <RanklyProjectKeywordsManager
          accountId={accountId}
          projectId={projectId}
          keywords={keywords}
        />

        <Link
          href={workAccountPath(workPaths.accountRanklyProjects, account)}
          className="inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          Back to all projects
        </Link>
      </PageBody>
    </>
  );
}
