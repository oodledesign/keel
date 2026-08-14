import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import featureFlagsConfig from '~/config/feature-flags.config';
import { loadWorkspaceAddonState } from '~/lib/billing/workspace-addon-state.loader';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { WorkspaceAddonsPanel } from '../_components/workspace-addons-panel';

interface WorkspaceAddonsSettingsPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    addon?: string;
  }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  return {
    title: `${i18n.t('teams:settings.pageTitle')} — Apps & add-ons`,
  };
};

async function WorkspaceAddonsSettingsPage({
  params,
  searchParams,
}: WorkspaceAddonsSettingsPageProps) {
  if (!featureFlagsConfig.enableTeamAccountBilling) {
    notFound();
  }

  const accountSlug = (await params).account;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  // Same gate as billing — viewers without billing access stay out.
  if (!access.canViewBilling) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const accountId = workspace.account.id as string;
  const addonState = await loadWorkspaceAddonState(
    client,
    user.id,
    accountId,
    workspace.workspaceProfile,
  );

  return (
    <WorkspaceAddonsPanel
      accountId={accountId}
      accountSlug={accountSlug}
      canManageBilling={access.canManageBilling}
      workspacePaid={addonState.workspacePaid}
      activeAddons={addonState.addons}
      highlightAddon={query.addon ?? null}
    />
  );
}

export default withI18n(WorkspaceAddonsSettingsPage);
