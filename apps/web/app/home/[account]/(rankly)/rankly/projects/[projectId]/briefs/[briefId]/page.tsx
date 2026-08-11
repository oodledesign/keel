import Link from 'next/link';
import { notFound } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import { loadBriefForUser } from '~/lib/briefs/db';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { loadRanklyProjectForTeam } from '../../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../../../../_lib/server/workspace-route-guard';
import { BriefView } from '../../../../../_components/briefs/brief-view';
import { RanklyProjectSectionHeader } from '../../../../../_components/rankly-project-section-header';

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
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

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
        className="text-primary inline-block text-sm underline-offset-4 hover:underline"
      >
        ← Back to briefs
      </Link>
    </div>
  );
}
