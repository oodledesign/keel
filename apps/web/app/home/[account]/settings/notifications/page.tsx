import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { canUseEmailAssistant } from '~/lib/billing/entitlements';
import { loadAccountBranches } from '~/lib/brand/account-branches';
import { loadCommercialBoardSettings } from '~/lib/commercial/board-company-settings.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { visibleEmailNotificationKeys } from '~/lib/notifications/email-notification-preferences';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { isCommercialPropertyProfile } from '../../_lib/workspace-profile';
import { BoardPromptSettingsCard } from '../_components/board-prompt-settings-card';
import { EmailNotificationPreferencesForm } from '../_components/email-notification-preferences-form';
import { loadEmailNotificationPreferences } from '../_lib/server/email-notification-preferences.loader';

interface NotificationsSettingsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  return { title: 'Notifications' };
};

async function TeamNotificationsSettingsPage({
  params,
}: NotificationsSettingsPageProps) {
  const slug = (await params).account;
  const user = await requireUserInServerComponent();
  const workspace = await loadTeamWorkspace(slug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const [preferences, emailAssistantAvailable] = await Promise.all([
    loadEmailNotificationPreferences(user.id),
    canUseEmailAssistant(getSupabaseServerClient(), user.id).catch(() => false),
  ]);
  const visibleKeys = visibleEmailNotificationKeys({
    workspaceProfile: workspace.workspaceProfile,
    businessLite: workspace.businessLite,
    emailAssistantAvailable,
  });

  const accountId = workspace.account.id as string;
  const showBoardPrompt = isCommercialPropertyProfile(
    workspace.workspaceProfile,
  );
  const [boardSettings, branches] = showBoardPrompt
    ? await Promise.all([
        loadCommercialBoardSettings(getSupabaseServerClient(), accountId),
        loadAccountBranches(accountId),
      ])
    : [null, []];

  return (
    <div className="flex flex-col gap-6">
      <EmailNotificationPreferencesForm
        initialPreferences={preferences}
        keys={visibleKeys}
      />
      {boardSettings ? (
        <BoardPromptSettingsCard
          accountId={accountId}
          initialEnabled={boardSettings.promptEnabled}
          initialOffBranchIds={boardSettings.promptOffBranchIds}
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          boardsSettingsHref={`${pathsConfig.app.accountCommercialPublishing.replace('[account]', slug)}?tab=boards`}
        />
      ) : null}
    </div>
  );
}

export default withI18n(TeamNotificationsSettingsPage);
