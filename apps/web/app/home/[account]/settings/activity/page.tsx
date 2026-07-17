import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { listActivityRulesAction } from '~/home/[account]/activity/_lib/server/activity-rules-actions';
import { createClientsService } from '~/home/[account]/clients/_lib/server/clients.service';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { ActivityPrivacySettingsForm } from './_components/ActivityPrivacySettingsForm';
import { ActivityRulesPanel } from './_components/ActivityRulesPanel';
import { getActivityPrivacySettings } from './actions';

interface ActivityPrivacySettingsPageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: `${i18n.t('teams:settings.pageTitle')} — Activity tracking`,
  };
};

async function ActivityPrivacySettingsPage({
  params,
}: ActivityPrivacySettingsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const settings = await getActivityPrivacySettings(workspace.account.id);
  const accountId = workspace.account.id;
  const client = getSupabaseServerClient();

  const [rulesResult, projectsResult, clientsResult] = await Promise.all([
    listActivityRulesAction(accountId),
    client
      .from('projects')
      .select('id, name, title, project_type')
      .eq('account_id', accountId)
      .eq('project_type', 'delivery')
      .order('name', { ascending: true })
      .limit(200),
    createClientsService(client).listClients({
      accountId,
      page: 1,
      pageSize: 100,
    }),
  ]);

  return (
    <div className="space-y-8">
      <ActivityPrivacySettingsForm
        accountId={accountId}
        initialSettings={settings}
      />
      <ActivityRulesPanel
        accountId={accountId}
        accountSlug={accountSlug}
        initialRules={rulesResult.rules}
        projects={(projectsResult.data ?? []).map((row) => ({
          id: row.id as string,
          name:
            (row.title as string | null)?.trim() ||
            (row.name as string | null)?.trim() ||
            'Project',
        }))}
        clients={(clientsResult.data ?? []).map((row) => ({
          id: row.id as string,
          name:
            row.display_name?.trim() || row.company_name?.trim() || 'Client',
        }))}
      />
    </div>
  );
}

export default withI18n(ActivityPrivacySettingsPage);
