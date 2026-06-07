import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';

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

        <section className="rounded-lg border border-white/10 bg-black/10 px-4 py-5">
          <h2 className="text-lg font-semibold">AI Search Audit</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Score entity, content, E-E-A-T, and tech readiness for AI search
            citations — with prioritised fix list and client-ready export.
          </p>
          <Link
            href={pathsConfig.app.accountRanklyProjectAiAudit
              .replace('[account]', account)
              .replace('[projectId]', projectId)}
            className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Open AI Search Audit →
          </Link>
        </section>

        <section className="rounded-lg border border-white/10 bg-black/10 px-4 py-5">
          <h2 className="text-lg font-semibold">Content brief generator</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            DataForSEO + Claude-powered writer-ready briefs with SERP teardown,
            template classification, and internal linking.
          </p>
          <Link
            href={pathsConfig.app.accountRanklyProjectBriefs
              .replace('[account]', account)
              .replace('[projectId]', projectId)}
            className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Open brief generator →
          </Link>
        </section>

        <section className="rounded-lg border border-white/10 bg-black/10 px-4 py-5">
          <h2 className="text-lg font-semibold">Keyword cluster builder</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Expand seed keywords into a pillar + spokes content plan using SERP
            overlap clustering.
          </p>
          <Link
            href={pathsConfig.app.accountRanklyProjectClusters
              .replace('[account]', account)
              .replace('[projectId]', projectId)}
            className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Open cluster builder →
          </Link>
        </section>

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
