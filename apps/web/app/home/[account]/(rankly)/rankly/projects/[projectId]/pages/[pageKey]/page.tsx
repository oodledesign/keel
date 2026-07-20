import { notFound } from 'next/navigation';

import { loadRanklyPageDetail } from '~/lib/rankly-pages/db';

import { loadRanklyProjectForTeam } from '../../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../../_lib/server/workspace-route-guard';
import { RanklyPageDetailView } from '../../../../../_components/pages/rankly-page-detail';
import { RanklyProjectSectionHeader } from '../../../../../_components/rankly-project-section-header';
import {
  ranklyPagespeedPagePath,
  ranklyProjectPaths,
} from '../../../../../_lib/rankly-project-paths';

type RanklyProjectPageDetailRouteProps = {
  params: Promise<{
    account: string;
    projectId: string;
    pageKey: string;
  }>;
};

export default async function RanklyProjectPageDetailRoute({
  params,
}: RanklyProjectPageDetailRouteProps) {
  const { account, projectId, pageKey } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  const page = await loadRanklyPageDetail(projectId, pageKey);
  if (!page) {
    notFound();
  }

  const paths = ranklyProjectPaths(account, projectId);
  const pagespeedDetailHref = page.pagespeedPageId
    ? ranklyPagespeedPagePath(account, projectId, page.pagespeedPageId)
    : null;

  return (
    <div className="space-y-6">
      <RanklyProjectSectionHeader
        title="Page detail"
        description="Combined crawl data, PageSpeed metrics, and tailored fix recommendations."
      />
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-5">
        <RanklyPageDetailView
          page={page}
          backHref={paths.pages}
          pagespeedDetailHref={pagespeedDetailHref}
          accountId={accountId}
          projectId={projectId}
          country={project.target_country}
        />
      </div>
    </div>
  );
}
