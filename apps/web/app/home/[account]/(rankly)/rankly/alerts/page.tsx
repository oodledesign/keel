import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import {
  ModuleDataSection,
  ModuleEmptyState,
} from '../../../_components/module-data-section';
import { loadRanklyAlertsForTeam } from '../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../_lib/work-account-path';

type RanklyAlertsPageProps = {
  params: Promise<{
    account: string;
  }>;
};

export default async function RanklyAlertsPage({
  params,
}: RanklyAlertsPageProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const alerts = await loadRanklyAlertsForTeam(workspace.account.id as string);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Rankly alerts"
        description="Threshold rules on keywords in your projects (same account scope)."
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <ModuleDataSection title="Alerts">
          {alerts.length === 0 ? (
            <ModuleEmptyState message="No alerts yet. Alerts reference rankly.keywords in your projects—add keywords first, then alert rows." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Threshold</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3">Keyword id</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="px-4 py-3">{a.alert_type}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {a.threshold ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {a.is_active ? 'Yes' : 'No'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {a.keyword_id}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModuleDataSection>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={workAccountPath(workPaths.accountRanklyProjects, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Projects
          </Link>
          <Link
            href={workAccountPath(workPaths.accountRanklyDashboard, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Dashboard
          </Link>
        </div>
      </PageBody>
    </>
  );
}
