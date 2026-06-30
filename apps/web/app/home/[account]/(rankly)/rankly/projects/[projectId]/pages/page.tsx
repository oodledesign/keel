import { notFound } from 'next/navigation';

import { RanklyPagesPanel } from '../../../../_components/pages/rankly-pages-panel';
import { RanklyProjectSectionHeader } from '../../../../_components/rankly-project-section-header';
import { ranklyProjectPaths } from '../../../../_lib/rankly-project-paths';
import { loadRanklyProjectForTeam } from '../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../_lib/server/workspace-route-guard';
import {
  loadRanklyPageInventory,
  loadRanklyPageInventoryMeta,
} from '~/lib/rankly-pages/db';

type RanklyProjectPagesPageProps = {
  params: Promise<{
    account: string;
    projectId: string;
  }>;
};

export default async function RanklyProjectPagesPage({
  params,
}: RanklyProjectPagesPageProps) {
  const { account, projectId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  const [pages, meta] = await Promise.all([
    loadRanklyPageInventory(projectId),
    loadRanklyPageInventoryMeta(projectId),
  ]);

  const paths = ranklyProjectPaths(account, projectId);

  return (
    <div className="space-y-6">
      <RanklyProjectSectionHeader
        title="Pages"
        description="Every URL with crawl or PageSpeed data — scored out of 100 with page-specific recommendations."
      />
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 p-5">
        <RanklyPagesPanel
          account={account}
          projectId={projectId}
          pages={pages}
          meta={meta}
          siteCrawlerHref={paths.siteCrawler}
          pagespeedHref={paths.pagespeed}
        />
      </div>
    </div>
  );
}
