import { notFound } from 'next/navigation';

import { ranklyProjectPaths } from '../../../../../_lib/rankly-project-paths';
import { PagespeedPageDetail } from '../../../../../_components/pagespeed/pagespeed-page-detail';
import { RanklyProjectSectionHeader } from '../../../../../_components/rankly-project-section-header';
import { loadRanklyProjectForTeam } from '../../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../../_lib/server/workspace-route-guard';
import {
  loadPagespeedPageHistory,
  loadPagespeedPageSnapshot,
} from '~/lib/pagespeed/db';

type RanklyProjectPagespeedPageDetailProps = {
  params: Promise<{
    account: string;
    projectId: string;
    pageId: string;
  }>;
};

export default async function RanklyProjectPagespeedPageDetail({
  params,
}: RanklyProjectPagespeedPageDetailProps) {
  const { account, projectId, pageId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  const [snapshot, history] = await Promise.all([
    loadPagespeedPageSnapshot(projectId, pageId),
    loadPagespeedPageHistory(projectId, pageId),
  ]);

  if (!snapshot || !history) {
    notFound();
  }

  const paths = ranklyProjectPaths(account, projectId);

  return (
    <div className="space-y-6">
      <RanklyProjectSectionHeader
        title="PageSpeed detail"
        description="Score history and Lighthouse fix recommendations for a tracked page."
      />
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 p-5">
        <PagespeedPageDetail
          snapshot={snapshot}
          history={history}
          backHref={paths.pagespeed}
        />
      </div>
    </div>
  );
}
