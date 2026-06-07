import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';

import { BriefView } from '../../../../../_components/briefs/brief-view';
import { TeamAccountLayoutPageHeader } from '../../../../../../_components/team-account-layout-page-header';
import { loadRanklyProjectForTeam } from '../../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../../_lib/server/workspace-route-guard';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { loadBriefForUser } from '~/lib/briefs/db';

type RanklyBriefDetailPageProps = {
  params: Promise<{ account: string; projectId: string; briefId: string }>;
};

function briefsPath(account: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectBriefs
    .replace('[account]', account)
    .replace('[projectId]', projectId);
}

export default async function RanklyBriefDetailPage({
  params,
}: RanklyBriefDetailPageProps) {
  const { account, projectId, briefId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const user = await requireUserInServerComponent();
  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) notFound();

  const brief = await loadBriefForUser(briefId, user.id);
  if (!brief || brief.project_id !== projectId) notFound();

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Content brief"
        description={brief.target_keyword}
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-4 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <BriefView brief={brief} />

        <Link
          href={briefsPath(account, projectId)}
          className="inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          Back to briefs
        </Link>
      </PageBody>
    </>
  );
}
