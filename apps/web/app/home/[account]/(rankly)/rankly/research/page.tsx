import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import {
  ModuleDataSection,
  ModuleEmptyState,
} from '../../../_components/module-data-section';
import { loadRanklyResearchCacheSample } from '../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../_lib/work-account-path';

type RanklyResearchPageProps = {
  params: Promise<{
    account: string;
  }>;
};

export default async function RanklyResearchPage({
  params,
}: RanklyResearchPageProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const cacheRows = await loadRanklyResearchCacheSample(25);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Keyword research cache"
        description="Shared DataForSEO-style cache entries (not per-account). Useful to confirm integrations wrote results."
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-4 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <ModuleDataSection title="Recent cache entries">
          {cacheRows.length === 0 ? (
            <ModuleEmptyState message="No rows in rankly.keyword_research_cache yet." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Seed keyword</th>
                    <th className="px-4 py-3">Country</th>
                    <th className="px-4 py-3">Language</th>
                    <th className="px-4 py-3">Cached</th>
                    <th className="px-4 py-3">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {cacheRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="px-4 py-3">{r.seed_keyword}</td>
                      <td className="px-4 py-3">{r.country}</td>
                      <td className="px-4 py-3">{r.language}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(r.cached_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(r.expires_at).toLocaleString()}
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
            href={workAccountPath(workPaths.accountRanklyAlerts, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Alerts
          </Link>
        </div>
      </PageBody>
    </>
  );
}
