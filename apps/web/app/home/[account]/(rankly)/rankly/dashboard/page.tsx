import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { ModuleDataSection } from '../../../_components/module-data-section';
import { RanklyDashboardProjectsPanel } from '../../_components/rankly-dashboard-projects-panel';
import {
  loadRanklyClientImportOptions,
  loadRanklyKeywordCountsByProject,
  loadRanklyProjectsForTeam,
  loadRanklyAlertsForTeam,
} from '../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../_lib/work-account-path';
import pathsConfig from '~/config/paths.config';

type RanklyDashboardPageProps = {
  params: Promise<{
    account: string;
  }>;
};

export default async function RanklyDashboardPage({
  params,
}: RanklyDashboardPageProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const [projects, keywordCounts, alerts, clientImportOptions] =
    await Promise.all([
      loadRanklyProjectsForTeam(accountId),
      loadRanklyKeywordCountsByProject(accountId),
      loadRanklyAlertsForTeam(accountId),
      loadRanklyClientImportOptions(accountId),
    ]);

  const clientLabels = Object.fromEntries(
    clientImportOptions.map((option) => [option.clientId, option.label]),
  );

  const keywordTotal = Object.values(keywordCounts).reduce((a, b) => a + b, 0);
  const activeAlerts = alerts.filter((a) => a.is_active).length;

  const clientsHref = pathsConfig.app.accountClients.replace(
    '[account]',
    account,
  );

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Rankly"
        description="SEO projects, tracked keywords, and alerts for this workspace."
      />
      <PageBody className="space-y-10 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="grid gap-4 px-4 sm:grid-cols-3 lg:px-0">
          <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Projects
            </p>
            <p className="mt-1 text-3xl font-semibold">{projects.length}</p>
          </div>
          <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Keywords
            </p>
            <p className="mt-1 text-3xl font-semibold">{keywordTotal}</p>
          </div>
          <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Active alerts
            </p>
            <p className="mt-1 text-3xl font-semibold">{activeAlerts}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              of {alerts.length} total
            </p>
          </div>
        </div>

        <ModuleDataSection
          title="Projects"
          description="Open a project to add keywords and view Site Explorer metrics. Keyword tracking is on each project page, not this dashboard."
        >
          <RanklyDashboardProjectsPanel
            accountSlug={account}
            accountId={accountId}
            clientsHref={clientsHref}
            clientImportOptions={clientImportOptions}
            projects={projects}
            keywordCounts={keywordCounts}
            clientLabels={clientLabels}
          />
        </ModuleDataSection>

        <div className="flex flex-wrap gap-3 px-4 text-sm lg:px-0">
          <Link
            href={workAccountPath(workPaths.accountRanklyProjects, account)}
            className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-2 transition hover:border-[color:var(--workspace-shell-border)]"
          >
            All projects
          </Link>
          <Link
            href={workAccountPath(workPaths.accountRanklyAlerts, account)}
            className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-2 transition hover:border-[color:var(--workspace-shell-border)]"
          >
            Alerts
          </Link>
          <Link
            href={workAccountPath(workPaths.accountRanklyResearch, account)}
            className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-2 transition hover:border-[color:var(--workspace-shell-border)]"
          >
            Keyword research cache
          </Link>
        </div>
      </PageBody>
    </>
  );
}
