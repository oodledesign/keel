import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  mapAccountTemplate,
  mapSystemTemplate,
} from '~/lib/content-templates/map-rows';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  WORK_DESIGN_SETTINGS_PROFILES,
  redirectIfProfileNotIn,
} from '../../_lib/server/workspace-route-guard';
import { WorkspaceTemplatesSettingsClient } from './_components/workspace-templates-settings-client';

export const generateMetadata = async () => ({
  title: 'Templates',
});

interface PageProps {
  params: Promise<{ account: string }>;
}

export default async function WorkspaceTemplatesSettingsPage(props: PageProps) {
  const { account } = await props.params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfProfileNotIn(workspace, account, WORK_DESIGN_SETTINGS_PROFILES);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(
      getDefaultAccountPath(
        account,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();

  const [{ data: systemRows }, { data: accountRows }] = await Promise.all([
    client
      .from('content_templates')
      .select('*')
      .in('kind', [
        'proposal_html',
        'proposal_email',
        'contract_email',
        'invoice_email',
      ])
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    client
      .from('account_content_templates')
      .select('*')
      .eq('account_id', accountId)
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false }),
  ]);

  return (
    <WorkspaceTemplatesSettingsClient
      accountId={accountId}
      accountSlug={account}
      canEdit={access.canManageSettings || access.canEditInvoices}
      systemTemplates={(systemRows ?? []).map((row) =>
        mapSystemTemplate(row as Record<string, unknown>),
      )}
      accountTemplates={(accountRows ?? []).map((row) =>
        mapAccountTemplate(row as Record<string, unknown>),
      )}
    />
  );
}
