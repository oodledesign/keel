import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { ModuleDataSection } from '../../../_components/module-data-section';
import {
  loadRanklyAlertsForTeam,
  loadRanklyKeywordCountsByProject,
  loadRanklyProjectsForTeam,
} from '../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../_lib/work-account-path';

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
  const [projects, keywordCounts, alerts] = await Promise.all([
    loadRanklyProjectsForTeam(accountId),
    loadRanklyKeywordCountsByProject(accountId),
    loadRanklyAlertsForTeam(accountId),
  ]);

  const keywordTotal = Object.values(keywordCounts).reduce((a, b) => a + b, 0);
  const activeAlerts = alerts.filter((a) => a.is_active).length;

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Rankly"
        description="SEO projects, tracked keywords, and alerts for this workspace."
      />
      <PageBody className="space-y-10 bg-[var(--workspace-shell-canvas)] px-4 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-black/10 p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Projects
            </p>
            <p className="mt-1 text-3xl font-semibold">{projects.length}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/10 p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Keywords
            </p>
            <p className="mt-1 text-3xl font-semibold">{keywordTotal}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/10 p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Active alerts
            </p>
            <p className="mt-1 text-3xl font-semibold">{activeAlerts}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              of {alerts.length} total
            </p>
          </div>
        </div>

        <ModuleDataSection title="Recent projects">
          {projects.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/10 px-4 py-6 text-sm">
              No projects yet. Create one via the Rankly API or seed{' '}
              <code className="text-xs">rankly.projects</code> for this account.
            </p>
          ) : (
            <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
              {projects.slice(0, 6).map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-muted-foreground text-sm">{p.domain}</p>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {keywordCounts[p.id] ?? 0} keywords
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ModuleDataSection>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={workAccountPath(workPaths.accountRanklyProjects, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            All projects
          </Link>
          <Link
            href={workAccountPath(workPaths.accountRanklyAlerts, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Alerts
          </Link>
          <Link
            href={workAccountPath(workPaths.accountRanklyResearch, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Keyword research cache
          </Link>
        </div>
      </PageBody>
    </>
  );
}
