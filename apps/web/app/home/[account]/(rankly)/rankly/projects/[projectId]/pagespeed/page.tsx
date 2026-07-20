import { notFound } from 'next/navigation';

import {
  loadLatestPagespeedCheckJob,
  loadPagespeedSettings,
  loadPagespeedSnapshots,
} from '~/lib/pagespeed/db';

import { loadRanklyProjectForTeam } from '../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../_lib/server/workspace-route-guard';
import { PagespeedPanel } from '../../../../_components/pagespeed/pagespeed-panel';
import { RanklyProjectSectionHeader } from '../../../../_components/rankly-project-section-header';

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

  const [pagespeedSettings, pagespeedSnapshots, latestPagespeedJob] =
    await Promise.all([
      loadPagespeedSettings(projectId),
      loadPagespeedSnapshots(projectId),
      loadLatestPagespeedCheckJob(projectId),
    ]);

  return (
    <div className="space-y-6">
      <RanklyProjectSectionHeader
        title="PageSpeed Insights"
        description="Track Lighthouse scores and Core Web Vitals for your homepage and key landing pages — refreshed automatically on your schedule."
      />
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-5">
        <PagespeedPanel
          account={account}
          accountId={accountId}
          projectId={projectId}
          domain={project.domain}
          settings={pagespeedSettings}
          snapshots={pagespeedSnapshots}
          latestJob={latestPagespeedJob}
        />
      </div>
    </div>
  );
}
