import { notFound } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import { SiteOverviewPanel } from '../../../../_components/site-overview/site-overview-panel';
import { loadRanklyProjectForTeam } from '../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../_lib/server/workspace-route-guard';
import {
  isSiteOverviewStale,
  loadSiteOverviewForProject,
} from '~/lib/site-overview/db';
import { projectCountryToCode } from '~/lib/site-overview/domain';

type RanklyProjectSiteExplorerPageProps = {
  params: Promise<{
    account: string;
    projectId: string;
  }>;
};

export default async function RanklyProjectSiteExplorerPage({
  params,
}: RanklyProjectSiteExplorerPageProps) {
  const { account, projectId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  const overview = await loadSiteOverviewForProject(projectId);
  const overviewStale = isSiteOverviewStale(overview);

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

  const auditHref = pathsConfig.app.accountRanklyProjectAiAudit
    .replace('[account]', account)
    .replace('[projectId]', projectId);

  return (
    <SiteOverviewPanel
      accountId={accountId}
      projectId={projectId}
      domain={project.domain}
      countryLabel={countryLabel}
      overview={overview}
      stale={overviewStale}
      auditHref={auditHref}
    />
  );
}
