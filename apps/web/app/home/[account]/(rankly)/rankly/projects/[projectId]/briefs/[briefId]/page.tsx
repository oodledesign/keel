import Link from 'next/link';
import { notFound } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import { BriefView } from '../../../../../_components/briefs/brief-view';
import { RanklyProjectSectionHeader } from '../../../../../_components/rankly-project-section-header';
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
    <div className="space-y-8">
      <RanklyProjectSectionHeader
        title="Content brief"
        description={brief.target_keyword}
      />

      <BriefView brief={brief} />

      <Link
        href={briefsPath(account, projectId)}
        className="inline-block text-sm text-primary underline-offset-4 hover:underline"
      >
        ← Back to briefs
      </Link>
    </div>
  );
}
