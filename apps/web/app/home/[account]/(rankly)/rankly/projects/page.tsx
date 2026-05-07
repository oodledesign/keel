import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { ModuleDataSection } from '../../../_components/module-data-section';
import { RanklyProjectsManager } from '../../_components/rankly-projects-manager';
import {
  loadRanklyKeywordCountsByProject,
  loadRanklyProjectsForTeam,
} from '../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../_lib/work-account-path';

type RanklyProjectsPageProps = {
  params: Promise<{
    account: string;
  }>;
};

export default async function RanklyProjectsPage({
  params,
}: RanklyProjectsPageProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const [projects, keywordCounts] = await Promise.all([
    loadRanklyProjectsForTeam(accountId),
    loadRanklyKeywordCountsByProject(accountId),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Rankly projects"
        description="Domains and keyword sets tracked for this team account."
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-4 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <ModuleDataSection title="Projects">
          <RanklyProjectsManager
            accountSlug={account}
            accountId={accountId}
            projects={projects}
            keywordCounts={keywordCounts}
          />
        </ModuleDataSection>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={workAccountPath(workPaths.accountRanklyDashboard, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Dashboard
          </Link>
          <Link
            href={workAccountPath(workPaths.accountRanklyResearch, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Research cache
          </Link>
        </div>
      </PageBody>
    </>
  );
}
