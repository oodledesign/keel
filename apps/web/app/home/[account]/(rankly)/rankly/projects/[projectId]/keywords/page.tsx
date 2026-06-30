import { notFound } from 'next/navigation';

import { RanklyProjectSectionHeader } from '../../../../_components/rankly-project-section-header';
import { RankTrackingPanel } from '../../../../_components/rank-tracking/rank-tracking-panel';
import {
  loadRanklyKeywordsForProject,
  loadRanklyProjectForTeam,
} from '../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../_lib/server/workspace-route-guard';
import {
  estimateProjectRankCheckCost,
  loadKeywordRankSnapshots,
  loadLatestRankCheckJob,
  loadRankTrackingSettings,
} from '~/lib/rank-tracking/db';

type RanklyProjectKeywordsPageProps = {
  params: Promise<{
    account: string;
    projectId: string;
  }>;
};

export default async function RanklyProjectKeywordsPage({
  params,
}: RanklyProjectKeywordsPageProps) {
  const { account, projectId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  const keywords = await loadRanklyKeywordsForProject(projectId, accountId);
  const rankSettings = await loadRankTrackingSettings(projectId);
  const [rankSnapshots, latestRankJob] = await Promise.all([
    loadKeywordRankSnapshots(projectId, rankSettings),
    loadLatestRankCheckJob(projectId),
  ]);
  const estimatedRankCost = rankSettings
    ? estimateProjectRankCheckCost(keywords.length, rankSettings)
    : 0;

  return (
    <div className="space-y-6">
      <RanklyProjectSectionHeader
        title="Keyword tracking"
        description="Track Google positions, schedule automatic refreshes, and see DataForSEO API usage per run."
      />
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 p-5">
        <RankTrackingPanel
          accountId={accountId}
          projectId={projectId}
          keywords={keywords}
          settings={rankSettings}
          snapshots={rankSnapshots}
          latestJob={latestRankJob}
          keywordCount={keywords.length}
          estimatedCostUsd={estimatedRankCost}
        />
      </div>
    </div>
  );
}
