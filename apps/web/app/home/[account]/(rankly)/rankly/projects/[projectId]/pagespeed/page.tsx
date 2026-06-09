import { notFound } from 'next/navigation';

import { RanklyProjectSectionHeader } from '../../../../_components/rankly-project-section-header';
import { PagespeedPanel } from '../../../../_components/pagespeed/pagespeed-panel';
import { loadRanklyProjectForTeam } from '../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../_lib/server/workspace-route-guard';
import {
  loadLatestPagespeedCheckJob,
  loadPagespeedHistory,
  loadPagespeedSettings,
  loadPagespeedSnapshots,
} from '~/lib/pagespeed/db';

type RanklyProjectPagespeedPageProps = {
  params: Promise<{
    account: string;
    projectId: string;
  }>;
};

export default async function RanklyProjectPagespeedPage({
  params,
}: RanklyProjectPagespeedPageProps) {
  const { account, projectId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  const [pagespeedSettings, pagespeedSnapshots, pagespeedHistory, latestPagespeedJob] =
    await Promise.all([
      loadPagespeedSettings(projectId),
      loadPagespeedSnapshots(projectId),
      loadPagespeedHistory(projectId),
      loadLatestPagespeedCheckJob(projectId),
    ]);

  return (
    <div className="space-y-6">
      <RanklyProjectSectionHeader
        title="PageSpeed Insights"
        description="Track Lighthouse scores and Core Web Vitals for your homepage and key landing pages — refreshed automatically on your schedule."
      />
      <div className="rounded-lg border border-white/10 bg-black/10 p-5">
        <PagespeedPanel
          accountId={accountId}
          projectId={projectId}
          domain={project.domain}
          settings={pagespeedSettings}
          snapshots={pagespeedSnapshots}
          history={pagespeedHistory}
          latestJob={latestPagespeedJob}
        />
      </div>
    </div>
  );
}
