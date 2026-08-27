import { redirect } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { getBrainIndexStats } from '~/lib/brain/indexer';

import { getTeamAccountAccess } from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  KNOWLEDGE_SETTINGS_PROFILES,
  redirectIfProfileNotIn,
} from '../../_lib/server/workspace-route-guard';
import { KnowledgeBaseSettings } from '../_components/knowledge-base-settings';

interface KnowledgeSettingsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Knowledge base',
});

async function KnowledgeSettingsPage({ params }: KnowledgeSettingsPageProps) {
  const { account: accountSlug } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfProfileNotIn(workspace, accountSlug, KNOWLEDGE_SETTINGS_PROFILES);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewDashboard) {
    redirect(
      pathsConfig.app.accountSettings.replace('[account]', accountSlug),
    );
  }

  const admin = getSupabaseServerAdminClient();
  const stats = await getBrainIndexStats(admin, workspace.account.id);

  return (
    <KnowledgeBaseSettings
      accountId={workspace.account.id}
      accountSlug={accountSlug}
      initialStats={stats}
    />
  );
}

export default KnowledgeSettingsPage;
