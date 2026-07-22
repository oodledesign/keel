import { notFound } from 'next/navigation';

import { loadPagespeedSnapshots } from '~/lib/pagespeed/db';
import { loadSiteOverviewForProject } from '~/lib/site-overview/db';
import { projectCountryToCode } from '~/lib/site-overview/domain';

import {
  loadRanklyKeywordsForProject,
  loadRanklyProjectForTeam,
} from '../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../_lib/server/workspace-route-guard';
import { RanklyProjectDashboard } from '../../../_components/rankly-project-dashboard';

type RanklyProjectDashboardPageProps = {
  params: Promise<{
    account: string;
    projectId: string;
  }>;
};

export default async function RanklyProjectDashboardPage({
  params,
}: RanklyProjectDashboardPageProps) {
  const { account, projectId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  const [keywords, overview, pagespeedSnapshots] = await Promise.all([
    loadRanklyKeywordsForProject(projectId, accountId),
    loadSiteOverviewForProject(projectId),
    loadPagespeedSnapshots(projectId),
  ]);

  const countryLabels: Record<string, string> = {
    gb: 'United Kingdom',
    us: 'United States',
    au: 'Australia',
    ca: 'Canada',
    ie: 'Ireland',
    nz: 'New Zealand',
    za: 'South Africa',
  };
  const countryCode = projectCountryToCode(project.target_country);
  const countryLabel = countryLabels[countryCode] ?? countryCode.toUpperCase();

  const homepage = pagespeedSnapshots.find((row) => row.isHomepage);

  return (
    <RanklyProjectDashboard
      account={account}
      accountId={accountId}
      projectId={projectId}
      keywordCount={keywords.length}
      overview={overview}
      pagespeedMobileScore={homepage?.mobile?.performanceScore ?? null}
      pagespeedDesktopScore={homepage?.desktop?.performanceScore ?? null}
      countryLabel={countryLabel}
    />
  );
}
