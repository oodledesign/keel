import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  estimateProjectRankCheckCost,
  loadKeywordRankSnapshots,
  loadLatestRankCheckJob,
  loadRankTrackingSettings,
} from '~/lib/rank-tracking/db';
import {
  loadGscConnection,
  toGscConnectionStatus,
} from '~/lib/rankly-gsc/connection';
import { isGscConfigured } from '~/lib/rankly-gsc/env';
import {
  loadGscKeywordSupplements,
  loadTopGscQueries,
} from '~/lib/rankly-gsc/metrics';
import type { GscKeywordSupplement } from '~/lib/rankly-gsc/types';

import {
  loadRanklyKeywordsForProject,
  loadRanklyProjectForTeam,
} from '../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../_lib/server/workspace-route-guard';
import { RankTrackingPanel } from '../../../../_components/rank-tracking/rank-tracking-panel';
import { RanklyGscSyncPanel } from '../../../../_components/rank-tracking/rankly-gsc-sync-panel';
import { RanklyProjectSectionHeader } from '../../../../_components/rankly-project-section-header';

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

  const client = getSupabaseServerClient();
  const keywords = await loadRanklyKeywordsForProject(projectId, accountId);
  const rankSettings = await loadRankTrackingSettings(projectId);
  const [rankSnapshots, latestRankJob, gscConnection, gscSupplements] =
    await Promise.all([
      loadKeywordRankSnapshots(projectId, rankSettings),
      loadLatestRankCheckJob(projectId),
      loadGscConnection(client, projectId),
      loadGscKeywordSupplements(client, projectId, { days: 28 }).catch(() => {
        return new Map<string, GscKeywordSupplement>();
      }),
    ]);

  const estimatedRankCost = rankSettings
    ? estimateProjectRankCheckCost(keywords.length, rankSettings)
    : 0;

  const gscStatus = toGscConnectionStatus(gscConnection);
  gscStatus.configured = isGscConfigured();

  const topQueries = gscConnection?.property_uri
    ? await loadTopGscQueries(client, projectId, { days: 28, limit: 15 }).catch(
        () => [],
      )
    : [];

  const gscByKeyword = Object.fromEntries(gscSupplements.entries());

  return (
    <div className="space-y-6">
      <RanklyProjectSectionHeader
        title="Keyword tracking"
        description="Track Google positions with DataForSEO, and supplement them with Search Console clicks and impressions."
      />
      <RanklyGscSyncPanel
        account={account}
        accountId={accountId}
        projectId={projectId}
        initialStatus={gscStatus}
        initialSites={[]}
        initialSuggestedProperty={null}
        initialTopQueries={topQueries}
      />
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-5">
        <RankTrackingPanel
          accountId={accountId}
          projectId={projectId}
          keywords={keywords}
          settings={rankSettings}
          snapshots={rankSnapshots}
          latestJob={latestRankJob}
          keywordCount={keywords.length}
          estimatedCostUsd={estimatedRankCost}
          gscByKeyword={gscByKeyword}
        />
      </div>
    </div>
  );
}
