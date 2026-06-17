import { getBrainIndexStats } from '~/lib/brain/indexer';
import { isVoyageConfigured } from '~/lib/brain/voyage';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { getTeamAccountAccess } from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
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
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewDashboard) {
    return null;
  }

  const admin = getSupabaseServerAdminClient();
  const stats = await getBrainIndexStats(admin, workspace.account.id);

  return (
    <KnowledgeBaseSettings
      accountId={workspace.account.id}
      accountSlug={accountSlug}
      initialStats={{
        ...stats,
        voyageConfigured: isVoyageConfigured(),
      }}
      voyageConfigured={isVoyageConfigured()}
    />
  );
}

export default KnowledgeSettingsPage;
