import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { RanklyProjectNav } from '../../../_components/rankly-project-nav';
import { TeamAccountLayoutPageHeader } from '../../../../_components/team-account-layout-page-header';
import { loadRanklyProjectForTeam } from '../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../../_lib/work-account-path';

type RanklyProjectLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    account: string;
    projectId: string;
  }>;
};

export default async function RanklyProjectLayout({
  children,
  params,
}: RanklyProjectLayoutProps) {
  const { account, projectId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  const projectsHref = workAccountPath(workPaths.accountRanklyProjects, account);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={project.name}
        description={project.domain}
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <Link
          href={projectsHref}
          className="text-primary mb-6 inline-block text-sm underline-offset-4 hover:underline"
        >
          ← All projects
        </Link>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <RanklyProjectNav account={account} projectId={projectId} />
          <div className="min-w-0 flex-1 space-y-8">{children}</div>
        </div>
      </PageBody>
    </>
  );
}
