import { notFound } from 'next/navigation';

import { RanklyProjectSectionHeader } from '../../../../_components/rankly-project-section-header';
import { SiteCrawlerPanel } from '../../../../_components/site-crawler/site-crawler-panel';
import { loadRanklyProjectForTeam } from '../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../_lib/server/workspace-route-guard';
import {
  loadLatestSiteCrawlJob,
  loadSiteCrawlPages,
} from '~/lib/site-crawl/db';
import { DEFAULT_SITE_CRAWL_URL_LIMIT } from '~/lib/site-crawl/types';

type RanklyProjectSiteCrawlerPageProps = {
  params: Promise<{
    account: string;
    projectId: string;
  }>;
};

export default async function RanklyProjectSiteCrawlerPage({
  params,
}: RanklyProjectSiteCrawlerPageProps) {
  const { account, projectId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  const latestJob = await loadLatestSiteCrawlJob(projectId);
  const pages = latestJob ? await loadSiteCrawlPages(latestJob.id, 1000) : [];

  return (
    <div className="space-y-6">
      <RanklyProjectSectionHeader
        title="Site Crawler"
        description="Internal technical SEO crawl — find broken pages, missing metadata, and duplicate titles across your site."
      />
      <div className="rounded-lg border border-white/10 bg-black/10 p-5">
        <SiteCrawlerPanel
          accountId={accountId}
          projectId={projectId}
          domain={project.domain}
          latestJob={latestJob}
          pages={pages}
          defaultUrlLimit={DEFAULT_SITE_CRAWL_URL_LIMIT}
        />
      </div>
    </div>
  );
}
