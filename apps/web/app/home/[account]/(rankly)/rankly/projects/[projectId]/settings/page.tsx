import { notFound } from 'next/navigation';

import { RanklyProjectSectionHeader } from '../../../../_components/rankly-project-section-header';
import { RanklyProjectSettingsForm } from '../../../../_components/rankly-project-settings-form';
import { loadRanklyProjectForTeam } from '../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../_lib/server/workspace-route-guard';

type RanklyProjectSettingsPageProps = {
  params: Promise<{ account: string; projectId: string }>;
};

export default async function RanklyProjectSettingsPage({
  params,
}: RanklyProjectSettingsPageProps) {
  const { account, projectId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <RanklyProjectSectionHeader
        title="Brief settings"
        description="Brand voice and mention rules applied when synthesising content briefs."
      />
      <RanklyProjectSettingsForm
        accountId={accountId}
        projectId={projectId}
        initial={{
          brief_brand_name: project.brief_brand_name,
          brief_voice_notes: project.brief_voice_notes,
          brief_mention_rules: project.brief_mention_rules,
          brief_research_depth: project.brief_research_depth,
        }}
      />
    </div>
  );
}
